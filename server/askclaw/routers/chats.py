from fastapi import APIRouter, Depends, HTTPException, Query, Response

from ..auth import get_current_user
from ..db import get_connection
from ..models import (
    ChatCreate,
    ChatDetail,
    ChatSummary,
    ChatUpdate,
    MessageOut,
    MessagesAppend,
)

router = APIRouter(prefix="/chats", tags=["chats"])


@router.get("", response_model=list[ChatSummary])
def list_chats(
    username: str = Depends(get_current_user),
    category_id: int | None = Query(None),
    tag_id: int | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    conn = get_connection()
    try:
        conditions = ["c.username = ?"]
        params: list = [username]

        if category_id is not None:
            conditions.append("c.category_id = ?")
            params.append(category_id)

        if tag_id is not None:
            conditions.append("EXISTS (SELECT 1 FROM chat_tags ct WHERE ct.chat_id = c.id AND ct.tag_id = ?)")
            params.append(tag_id)

        where = " AND ".join(conditions)
        params.extend([limit, offset])

        rows = conn.execute(
            f"SELECT c.id, c.title, c.model, c.category_id, c.created_at, c.updated_at "
            f"FROM chats c WHERE {where} "
            f"ORDER BY c.updated_at DESC LIMIT ? OFFSET ?",
            params,
        ).fetchall()

        result = []
        for row in rows:
            tag_rows = conn.execute(
                "SELECT tag_id FROM chat_tags WHERE chat_id = ?", (row["id"],)
            ).fetchall()
            result.append(
                ChatSummary(
                    id=row["id"],
                    title=row["title"],
                    model=row["model"],
                    category_id=row["category_id"],
                    tag_ids=[r["tag_id"] for r in tag_rows],
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                )
            )
        return result
    finally:
        conn.close()


@router.post("", response_model=ChatSummary, status_code=201)
def create_chat(
    body: ChatCreate,
    username: str = Depends(get_current_user),
):
    conn = get_connection()
    try:
        title = body.title or ""
        conn.execute(
            "INSERT INTO chats (id, username, title, model) VALUES (?, ?, ?, ?)",
            (body.id, username, title, body.model),
        )
        conn.commit()
        return ChatSummary(
            id=body.id,
            title=title,
            model=body.model,
            category_id=None,
            tag_ids=[],
            created_at="",
            updated_at="",
        )
    except Exception as e:
        if "UNIQUE" in str(e):
            raise HTTPException(409, "Chat already exists")
        raise
    finally:
        conn.close()


@router.get("/{chat_id}", response_model=ChatDetail)
def get_chat(
    chat_id: str,
    username: str = Depends(get_current_user),
):
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT id, title, model, category_id, created_at, updated_at "
            "FROM chats WHERE id = ? AND username = ?",
            (chat_id, username),
        ).fetchone()
        if not row:
            raise HTTPException(404, "Chat not found")

        msg_rows = conn.execute(
            "SELECT id, role, content, created_at FROM messages WHERE chat_id = ? ORDER BY id",
            (chat_id,),
        ).fetchall()

        tag_rows = conn.execute(
            "SELECT tag_id FROM chat_tags WHERE chat_id = ?", (chat_id,)
        ).fetchall()

        return ChatDetail(
            id=row["id"],
            title=row["title"],
            model=row["model"],
            category_id=row["category_id"],
            tag_ids=[r["tag_id"] for r in tag_rows],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            messages=[
                MessageOut(
                    id=m["id"],
                    role=m["role"],
                    content=m["content"],
                    created_at=m["created_at"],
                )
                for m in msg_rows
            ],
        )
    finally:
        conn.close()


@router.patch("/{chat_id}", response_model=ChatSummary)
def update_chat(
    chat_id: str,
    body: ChatUpdate,
    username: str = Depends(get_current_user),
):
    conn = get_connection()
    try:
        existing = conn.execute(
            "SELECT id FROM chats WHERE id = ? AND username = ?",
            (chat_id, username),
        ).fetchone()
        if not existing:
            raise HTTPException(404, "Chat not found")

        sets = []
        params: list = []
        if body.title is not None:
            sets.append("title = ?")
            params.append(body.title)
        if body.category_id is not None:
            sets.append("category_id = ?")
            params.append(body.category_id)

        if sets:
            sets.append("updated_at = datetime('now')")
            params.append(chat_id)
            conn.execute(
                f"UPDATE chats SET {', '.join(sets)} WHERE id = ?",
                params,
            )

        if body.tag_ids is not None:
            conn.execute("DELETE FROM chat_tags WHERE chat_id = ?", (chat_id,))
            for tid in body.tag_ids:
                conn.execute(
                    "INSERT OR IGNORE INTO chat_tags (chat_id, tag_id) VALUES (?, ?)",
                    (chat_id, tid),
                )

        conn.commit()

        row = conn.execute(
            "SELECT id, title, model, category_id, created_at, updated_at "
            "FROM chats WHERE id = ?",
            (chat_id,),
        ).fetchone()

        tag_rows = conn.execute(
            "SELECT tag_id FROM chat_tags WHERE chat_id = ?", (chat_id,)
        ).fetchall()

        return ChatSummary(
            id=row["id"],
            title=row["title"],
            model=row["model"],
            category_id=row["category_id"],
            tag_ids=[r["tag_id"] for r in tag_rows],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
    finally:
        conn.close()


@router.delete("/{chat_id}", status_code=204)
def delete_chat(
    chat_id: str,
    username: str = Depends(get_current_user),
):
    conn = get_connection()
    try:
        result = conn.execute(
            "DELETE FROM chats WHERE id = ? AND username = ?",
            (chat_id, username),
        )
        conn.commit()
        if result.rowcount == 0:
            raise HTTPException(404, "Chat not found")
        return Response(status_code=204)
    finally:
        conn.close()


@router.post("/{chat_id}/messages", response_model=list[MessageOut], status_code=201)
def append_messages(
    chat_id: str,
    body: MessagesAppend,
    username: str = Depends(get_current_user),
):
    conn = get_connection()
    try:
        chat = conn.execute(
            "SELECT id, title FROM chats WHERE id = ? AND username = ?",
            (chat_id, username),
        ).fetchone()
        if not chat:
            raise HTTPException(404, "Chat not found")

        # Auto-generate title from first user message if title is empty
        if not chat["title"]:
            for msg in body.messages:
                if msg.role == "user":
                    title = msg.content[:50].strip()
                    if len(msg.content) > 50:
                        title += "..."
                    conn.execute(
                        "UPDATE chats SET title = ? WHERE id = ?",
                        (title, chat_id),
                    )
                    break

        inserted = []
        for msg in body.messages:
            cursor = conn.execute(
                "INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)",
                (chat_id, msg.role, msg.content),
            )
            row = conn.execute(
                "SELECT id, role, content, created_at FROM messages WHERE id = ?",
                (cursor.lastrowid,),
            ).fetchone()
            inserted.append(
                MessageOut(
                    id=row["id"],
                    role=row["role"],
                    content=row["content"],
                    created_at=row["created_at"],
                )
            )

        conn.execute(
            "UPDATE chats SET updated_at = datetime('now') WHERE id = ?",
            (chat_id,),
        )
        conn.commit()

        return inserted
    finally:
        conn.close()
