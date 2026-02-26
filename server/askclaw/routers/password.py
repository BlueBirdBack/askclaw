import hashlib
import secrets
import subprocess
from pathlib import Path

import bcrypt
from fastapi import APIRouter, Depends, HTTPException

from ..auth import get_current_user
from ..config import settings
from ..models import PasswordChange

router = APIRouter(prefix="/password", tags=["password"])

# --- apr1 (Apache MD5) helpers ---

_ITOA64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"


def _to64(v: int, n: int) -> str:
    result = ""
    for _ in range(n):
        result += _ITOA64[v & 0x3F]
        v >>= 6
    return result


def _apr1_verify(password: str, stored: str) -> bool:
    """Verify a password against an $apr1$ hash."""
    parts = stored.split("$")
    if len(parts) != 4 or parts[1] != "apr1":
        return False
    salt = parts[2]
    return _apr1_hash(password, salt) == stored


def _apr1_hash(password: str, salt: str) -> str:
    """Compute an $apr1$ (Apache MD5) hash."""
    pw = password.encode()
    ctx = hashlib.md5(pw + b"$apr1$" + salt.encode())
    ctx1 = hashlib.md5(pw + salt.encode() + pw).digest()

    plen = len(pw)
    i = plen
    while i > 0:
        ctx.update(ctx1[: min(i, 16)])
        i -= 16

    i = plen
    while i:
        if i & 1:
            ctx.update(b"\x00")
        else:
            ctx.update(pw[:1])
        i >>= 1

    final = ctx.digest()

    for i in range(1000):
        ctx1 = hashlib.md5()
        if i & 1:
            ctx1.update(pw)
        else:
            ctx1.update(final)
        if i % 3:
            ctx1.update(salt.encode())
        if i % 7:
            ctx1.update(pw)
        if i & 1:
            ctx1.update(final)
        else:
            ctx1.update(pw)
        final = ctx1.digest()

    result = (
        _to64((final[0] << 16) | (final[6] << 8) | final[12], 4)
        + _to64((final[1] << 16) | (final[7] << 8) | final[13], 4)
        + _to64((final[2] << 16) | (final[8] << 8) | final[14], 4)
        + _to64((final[3] << 16) | (final[9] << 8) | final[15], 4)
        + _to64((final[4] << 16) | (final[10] << 8) | final[5], 4)
        + _to64(final[11], 2)
    )
    return f"$apr1${salt}${result}"


# --- htpasswd file I/O ---


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


def _verify_password(password: str, stored_hash: str) -> bool:
    """Verify password against stored hash (supports $apr1$ and $2b$/$2a$/$2y$)."""
    if stored_hash.startswith("$apr1$"):
        return _apr1_verify(password, stored_hash)
    if stored_hash.startswith(("$2b$", "$2a$", "$2y$")):
        return bcrypt.checkpw(password.encode(), stored_hash.encode())
    return False


def _make_hash(password: str) -> str:
    """Generate a new $apr1$ hash for consistency with existing entries."""
    salt = "".join(secrets.choice(_ITOA64) for _ in range(8))
    return _apr1_hash(password, salt)


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
    if not _verify_password(body.current_password, stored_hash):
        raise HTTPException(403, "Current password is incorrect")

    entries[username] = _make_hash(body.new_password)
    _write_htpasswd(entries)

    return {"ok": True}
