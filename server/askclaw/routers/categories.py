from fastapi import APIRouter, Depends, HTTPException, Response

from ..auth import get_current_user
from ..db import get_connection
from ..models import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(username: str = Depends(get_current_user)):
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT id, name, sort_order FROM categories "
            "WHERE username = ? ORDER BY sort_order, name",
            (username,),
        ).fetchall()
        return [CategoryOut(id=r["id"], name=r["name"], sort_order=r["sort_order"]) for r in rows]
    finally:
        conn.close()


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(body: CategoryCreate, username: str = Depends(get_current_user)):
    conn = get_connection()
    try:
        cursor = conn.execute(
            "INSERT INTO categories (username, name, sort_order) VALUES (?, ?, ?)",
            (username, body.name, body.sort_order),
        )
        conn.commit()
        return CategoryOut(id=cursor.lastrowid, name=body.name, sort_order=body.sort_order)
    except Exception as e:
        if "UNIQUE" in str(e):
            raise HTTPException(409, "Category already exists")
        raise
    finally:
        conn.close()


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    body: CategoryUpdate,
    username: str = Depends(get_current_user),
):
    conn = get_connection()
    try:
        existing = conn.execute(
            "SELECT id FROM categories WHERE id = ? AND username = ?",
            (category_id, username),
        ).fetchone()
        if not existing:
            raise HTTPException(404, "Category not found")

        sets = []
        params: list = []
        if body.name is not None:
            sets.append("name = ?")
            params.append(body.name)
        if body.sort_order is not None:
            sets.append("sort_order = ?")
            params.append(body.sort_order)

        if sets:
            params.append(category_id)
            conn.execute(
                f"UPDATE categories SET {', '.join(sets)} WHERE id = ?",
                params,
            )
            conn.commit()

        row = conn.execute(
            "SELECT id, name, sort_order FROM categories WHERE id = ?",
            (category_id,),
        ).fetchone()
        return CategoryOut(id=row["id"], name=row["name"], sort_order=row["sort_order"])
    finally:
        conn.close()


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: int, username: str = Depends(get_current_user)):
    conn = get_connection()
    try:
        result = conn.execute(
            "DELETE FROM categories WHERE id = ? AND username = ?",
            (category_id, username),
        )
        conn.commit()
        if result.rowcount == 0:
            raise HTTPException(404, "Category not found")
        return Response(status_code=204)
    finally:
        conn.close()
