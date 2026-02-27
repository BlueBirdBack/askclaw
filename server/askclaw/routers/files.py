import mimetypes
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..auth import get_current_user
from ..config import settings
from ..db import get_connection
from ..models import AttachmentOut

router = APIRouter(prefix="/files", tags=["files"])

CHUNK_SIZE = 64 * 1024  # 64 KB


def _resolve_content_type(upload: UploadFile) -> str:
    """Return the best content type, falling back to extension-based guess."""
    ct = upload.content_type
    if ct and ct != "application/octet-stream":
        return ct
    if upload.filename:
        guessed, _ = mimetypes.guess_type(upload.filename)
        if guessed:
            return guessed
    return ct or "application/octet-stream"


@router.post("", response_model=list[AttachmentOut], status_code=201)
async def upload_files(
    files: list[UploadFile],
    username: str = Depends(get_current_user),
):
    if len(files) > settings.max_files_per_message:
        raise HTTPException(400, f"Maximum {settings.max_files_per_message} files allowed")

    results: list[AttachmentOut] = []
    conn = get_connection()
    try:
        user_dir = Path(settings.upload_dir) / username
        user_dir.mkdir(parents=True, exist_ok=True)

        for f in files:
            content_type = _resolve_content_type(f)
            if content_type not in settings.allowed_file_types:
                raise HTTPException(400, f"Unsupported file type: {content_type}")

            file_id = str(uuid.uuid4())
            original_name = f.filename or "file"
            ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else "bin"
            storage_name = f"{file_id}.{ext}"
            storage_path = user_dir / storage_name

            # Stream upload to disk in chunks, abort if size exceeds limit
            total_size = 0
            try:
                with open(storage_path, "wb") as out:
                    while True:
                        chunk = await f.read(CHUNK_SIZE)
                        if not chunk:
                            break
                        total_size += len(chunk)
                        if total_size > settings.max_file_size:
                            out.close()
                            storage_path.unlink(missing_ok=True)
                            raise HTTPException(400, f"File too large: {original_name}")
                        out.write(chunk)
            except HTTPException:
                raise
            except Exception:
                storage_path.unlink(missing_ok=True)
                raise HTTPException(500, "Upload failed")

            conn.execute(
                "INSERT INTO attachments (id, username, filename, content_type, size, storage_path) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (file_id, username, original_name, content_type, total_size, str(storage_path)),
            )

            results.append(AttachmentOut(
                id=file_id,
                filename=original_name,
                content_type=content_type,
                size=total_size,
                url=f"/api/files/{file_id}",
            ))

        conn.commit()
        return results
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(500, "Upload failed")
    finally:
        conn.close()


@router.get("/{file_id}")
def get_file(
    file_id: str,
    username: str = Depends(get_current_user),
):
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT storage_path, content_type, filename FROM attachments WHERE id = ? AND username = ?",
            (file_id, username),
        ).fetchone()
        if not row:
            raise HTTPException(404, "File not found")

        path = Path(row["storage_path"])

        # Path traversal guard
        if not path.resolve().is_relative_to(Path(settings.upload_dir).resolve()):
            raise HTTPException(403, "Access denied")

        if not path.exists():
            raise HTTPException(404, "File not found on disk")

        return FileResponse(
            path=str(path),
            media_type=row["content_type"],
            filename=row["filename"],
        )
    finally:
        conn.close()
