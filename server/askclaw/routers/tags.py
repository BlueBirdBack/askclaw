from fastapi import APIRouter, Depends, HTTPException, Response

from ..auth import get_current_user
from ..db import get_connection
from ..models import TagCreate, TagOut, TagUpdate

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagOut])
def list_tags(username: str = Depends(get_current_user)):
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT id, name, color FROM tags WHERE username = ? ORDER BY name",
            (username,),
        ).fetchall()
        return [TagOut(id=r["id"], name=r["name"], color=r["color"]) for r in rows]
    finally:
        conn.close()


@router.post("", response_model=TagOut, status_code=201)
def create_tag(body: TagCreate, username: str = Depends(get_current_user)):
    conn = get_connection()
    try:
        cursor = conn.execute(
            "INSERT INTO tags (username, name, color) VALUES (?, ?, ?)",
            (username, body.name, body.color),
        )
        conn.commit()
        return TagOut(id=cursor.lastrowid, name=body.name, color=body.color)
    except Exception as e:
        if "UNIQUE" in str(e):
            raise HTTPException(409, "Tag already exists")
        raise
    finally:
        conn.close()


@router.patch("/{tag_id}", response_model=TagOut)
def update_tag(
    tag_id: int,
    body: TagUpdate,
    username: str = Depends(get_current_user),
):
    conn = get_connection()
    try:
        existing = conn.execute(
            "SELECT id FROM tags WHERE id = ? AND username = ?",
            (tag_id, username),
        ).fetchone()
        if not existing:
            raise HTTPException(404, "Tag not found")

        sets = []
        params: list = []
        if body.name is not None:
            sets.append("name = ?")
            params.append(body.name)
        if body.color is not None:
            sets.append("color = ?")
            params.append(body.color)

        if sets:
            params.append(tag_id)
            conn.execute(
                f"UPDATE tags SET {', '.join(sets)} WHERE id = ?",
                params,
            )
            conn.commit()

        row = conn.execute(
            "SELECT id, name, color FROM tags WHERE id = ?", (tag_id,)
        ).fetchone()
        return TagOut(id=row["id"], name=row["name"], color=row["color"])
    finally:
        conn.close()


@router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: int, username: str = Depends(get_current_user)):
    conn = get_connection()
    try:
        result = conn.execute(
            "DELETE FROM tags WHERE id = ? AND username = ?",
            (tag_id, username),
        )
        conn.commit()
        if result.rowcount == 0:
            raise HTTPException(404, "Tag not found")
        return Response(status_code=204)
    finally:
        conn.close()
