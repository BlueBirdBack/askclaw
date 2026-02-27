import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..auth import get_current_user
from ..config import settings
from ..db import get_connection
from ..models import AttachmentOut

router = APIRouter(prefix="/files", tags=["files"])


@router.post("", response_model=list[AttachmentOut], status_code=201)
async def upload_files(
    files: list[UploadFile],
    username: str = Depends(get_current_user),
):
    if len(files) > settings.max_images_per_message:
        raise HTTPException(400, f"Maximum {settings.max_images_per_message} images allowed")

    results: list[AttachmentOut] = []
    conn = get_connection()
    try:
        user_dir = Path(settings.upload_dir) / username
        user_dir.mkdir(parents=True, exist_ok=True)

        for f in files:
            if f.content_type not in settings.allowed_image_types:
                raise HTTPException(400, f"Unsupported file type: {f.content_type}")

            data = await f.read()
            if len(data) > settings.max_image_size:
                raise HTTPException(400, f"File too large: {f.filename} ({len(data)} bytes)")

            file_id = str(uuid.uuid4())
            ext = (f.filename or "image").rsplit(".", 1)[-1].lower()
            if ext not in ("jpg", "jpeg", "png", "gif", "webp"):
                ext = "bin"
            storage_name = f"{file_id}.{ext}"
            storage_path = user_dir / storage_name

            storage_path.write_bytes(data)

            conn.execute(
                "INSERT INTO attachments (id, username, filename, content_type, size, storage_path) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (file_id, username, f.filename or "image", f.content_type, len(data), str(storage_path)),
            )

            results.append(AttachmentOut(
                id=file_id,
                filename=f.filename or "image",
                content_type=f.content_type,
                size=len(data),
                url=f"/api/files/{file_id}",
            ))

        conn.commit()
        return results
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {e}")
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
        if not path.exists():
            raise HTTPException(404, "File not found on disk")

        return FileResponse(
            path=str(path),
            media_type=row["content_type"],
            filename=row["filename"],
        )
    finally:
        conn.close()
