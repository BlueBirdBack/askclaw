from pathlib import Path

import bcrypt
from fastapi import APIRouter, Depends, HTTPException

from ..auth import get_current_user
from ..config import settings
from ..models import PasswordChange

router = APIRouter(prefix="/password", tags=["password"])


def _read_htpasswd() -> dict[str, str]:
    """Parse htpasswd file into {username: hash} dict."""
    entries: dict[str, str] = {}
    path = Path(settings.htpasswd_path)
    if not path.exists():
        return entries
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split(":", 1)
        if len(parts) == 2:
            entries[parts[0]] = parts[1]
    return entries


def _write_htpasswd(entries: dict[str, str]) -> None:
    """Write {username: hash} dict back to htpasswd file."""
    lines = [f"{user}:{hsh}" for user, hsh in entries.items()]
    Path(settings.htpasswd_path).write_text("\n".join(lines) + "\n")


@router.post("")
def change_password(
    body: PasswordChange,
    username: str = Depends(get_current_user),
):
    entries = _read_htpasswd()
    if not entries:
        raise HTTPException(500, "htpasswd file not found or empty")

    if username not in entries:
        raise HTTPException(404, "User not found in htpasswd")

    stored_hash = entries[username]
    if not bcrypt.checkpw(
        body.current_password.encode(), stored_hash.encode()
    ):
        raise HTTPException(403, "Current password is incorrect")

    new_hash = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
    entries[username] = new_hash
    _write_htpasswd(entries)

    return {"ok": True}
