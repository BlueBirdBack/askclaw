import base64

from fastapi import Header, HTTPException


def get_current_user(
    x_forwarded_user: str | None = Header(None),
    authorization: str | None = Header(None),
) -> str:
    """Extract username from nginx X-Forwarded-User or Basic auth header."""
    if x_forwarded_user:
        return x_forwarded_user.strip()

    if authorization and authorization.lower().startswith("basic "):
        try:
            decoded = base64.b64decode(authorization[6:]).decode()
            username = decoded.split(":", 1)[0]
            if username:
                return username
        except Exception:
            pass

    raise HTTPException(status_code=401, detail="Authentication required")
