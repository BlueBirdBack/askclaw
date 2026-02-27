import io

import pytest


def _jpeg_bytes(size: int = 128) -> bytes:
    """Return `size` bytes of fake JPEG data."""
    return b"\xff\xd8\xff\xe0" + b"\x00" * (size - 4)


def _upload(client, files, **kwargs):
    """Helper to POST files to /api/files."""
    return client.post("/api/files", files=files, **kwargs)


# --- Upload tests ---

def test_single_upload(test_env):
    data = _jpeg_bytes(256)
    resp = _upload(test_env, files=[("files", ("photo.jpg", io.BytesIO(data), "image/jpeg"))])
    assert resp.status_code == 201
    items = resp.json()
    assert len(items) == 1
    item = items[0]
    assert item["filename"] == "photo.jpg"
    assert item["content_type"] == "image/jpeg"
    assert item["size"] == 256
    assert item["url"].startswith("/api/files/")
    assert item["id"]
    assert item["storage_path"]  # new field returned


def test_multiple_upload(test_env):
    files = [
        ("files", (f"img{i}.png", io.BytesIO(_jpeg_bytes(64)), "image/png"))
        for i in range(3)
    ]
    resp = _upload(test_env, files=files)
    assert resp.status_code == 201
    assert len(resp.json()) == 3
    ids = {item["id"] for item in resp.json()}
    assert len(ids) == 3  # all distinct


def test_too_many_files(test_env):
    files = [
        ("files", (f"img{i}.jpg", io.BytesIO(_jpeg_bytes(32)), "image/jpeg"))
        for i in range(6)
    ]
    resp = _upload(test_env, files=files)
    assert resp.status_code == 400
    assert "Maximum 5" in resp.json()["detail"]


def test_unsupported_type(test_env):
    resp = _upload(test_env, files=[("files", ("data.bin", io.BytesIO(b"\x00\x01"), "application/octet-stream"))])
    assert resp.status_code == 400
    assert "Unsupported file type" in resp.json()["detail"]


def test_pdf_upload_allowed(test_env):
    resp = _upload(test_env, files=[("files", ("doc.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf"))])
    assert resp.status_code == 201
    item = resp.json()[0]
    assert item["filename"] == "doc.pdf"
    assert item["content_type"] == "application/pdf"


def test_file_too_large(test_env):
    big = _jpeg_bytes(51 * 1024 * 1024)
    resp = _upload(test_env, files=[("files", ("huge.jpg", io.BytesIO(big), "image/jpeg"))])
    assert resp.status_code == 400
    assert "too large" in resp.json()["detail"]


def test_no_extension_stored_as_bin(test_env):
    resp = _upload(test_env, files=[("files", ("noext", io.BytesIO(_jpeg_bytes(64)), "image/jpeg"))])
    assert resp.status_code == 201
    # The storage path should end with .bin since "noext" has no recognized extension
    item = resp.json()[0]
    assert item["filename"] == "noext"


def test_db_row_has_null_message_id(test_env):
    """Uploaded files start with message_id = NULL (not linked to a message yet)."""
    resp = _upload(test_env, files=[("files", ("test.jpg", io.BytesIO(_jpeg_bytes(64)), "image/jpeg"))])
    assert resp.status_code == 201
    file_id = resp.json()[0]["id"]

    # Query DB directly to verify message_id is NULL
    from askclaw.db import get_connection
    conn = get_connection()
    row = conn.execute("SELECT message_id FROM attachments WHERE id = ?", (file_id,)).fetchone()
    conn.close()
    assert row["message_id"] is None


# --- Download tests ---

def test_download_uploaded_file(test_env):
    data = _jpeg_bytes(512)
    upload_resp = _upload(test_env, files=[("files", ("dl.jpg", io.BytesIO(data), "image/jpeg"))])
    file_id = upload_resp.json()[0]["id"]

    dl_resp = test_env.get(f"/api/files/{file_id}")
    assert dl_resp.status_code == 200
    assert dl_resp.headers["content-type"] == "image/jpeg"
    assert dl_resp.content == data


def test_download_nonexistent_returns_404(test_env):
    resp = test_env.get("/api/files/nonexistent-id")
    assert resp.status_code == 404


def test_download_other_user_file_returns_404(test_env, other_user_client):
    # Upload as testuser
    upload_resp = _upload(test_env, files=[("files", ("secret.jpg", io.BytesIO(_jpeg_bytes(64)), "image/jpeg"))])
    file_id = upload_resp.json()[0]["id"]

    # Try to download as otheruser
    resp = other_user_client.get(f"/api/files/{file_id}")
    assert resp.status_code == 404
