from fastapi import APIRouter, Depends, HTTPException, Query, Response

from ..auth import get_current_user
from ..db import get_connection
from ..models import (
    AttachmentOut,
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

        # Batch-fetch tags for all chats (avoids N+1 queries)
        chat_ids = [row["id"] for row in rows]
        tags_by_chat: dict[str, list[int]] = {}
        if chat_ids:
            placeholders = ",".join("?" * len(chat_ids))
            tag_rows = conn.execute(
                f"SELECT chat_id, tag_id FROM chat_tags WHERE chat_id IN ({placeholders})",
                chat_ids,
            ).fetchall()
            for tr in tag_rows:
                tags_by_chat.setdefault(tr["chat_id"], []).append(tr["tag_id"])

        return [
            ChatSummary(
                id=row["id"],
                title=row["title"],
                model=row["model"],
                category_id=row["category_id"],
                tag_ids=tags_by_chat.get(row["id"], []),
                created_at=row["created_at"],
                updated_at=row["updated_at"],
            )
            for row in rows
        ]
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
        row = conn.execute(
            "SELECT created_at, updated_at FROM chats WHERE id = ?",
            (body.id,),
        ).fetchone()
        return ChatSummary(
            id=body.id,
            title=title,
            model=body.model,
            category_id=None,
            tag_ids=[],
            created_at=row["created_at"] if row else "",
            updated_at=row["updated_at"] if row else "",
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

        # Build attachment lookup by message_id
        msg_ids = [m["id"] for m in msg_rows]
        att_by_msg: dict[int, list[AttachmentOut]] = {}
        if msg_ids:
            placeholders = ",".join("?" * len(msg_ids))
            att_rows = conn.execute(
                f"SELECT id, message_id, filename, content_type, size "
                f"FROM attachments WHERE message_id IN ({placeholders})",
                msg_ids,
            ).fetchall()
            for a in att_rows:
                att_by_msg.setdefault(a["message_id"], []).append(
                    AttachmentOut(
                        id=a["id"],
                        filename=a["filename"],
                        content_type=a["content_type"],
                        size=a["size"],
                        url=f"/api/files/{a['id']}",
                    )
                )

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
                    attachments=att_by_msg.get(m["id"], []),
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

        # Verify category belongs to this user
        if body.category_id is not None:
            row = conn.execute(
                "SELECT id FROM categories WHERE id = ? AND username = ?",
                (body.category_id, username),
            ).fetchone()
            if not row:
                raise HTTPException(403, "Category not found")

        # Verify all tags belong to this user
        if body.tag_ids is not None:
            for tid in body.tag_ids:
                row = conn.execute(
                    "SELECT id FROM tags WHERE id = ? AND username = ?",
                    (tid, username),
                ).fetchone()
                if not row:
                    raise HTTPException(403, "Tag not found")

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
            msg_id = cursor.lastrowid

            # Link attachments to this message
            attachments: list[AttachmentOut] = []
            if msg.attachment_ids:
                for att_id in msg.attachment_ids:
                    conn.execute(
                        "UPDATE attachments SET message_id = ? WHERE id = ? AND username = ? AND message_id IS NULL",
                        (msg_id, att_id, username),
                    )
                att_rows = conn.execute(
                    f"SELECT id, filename, content_type, size FROM attachments "
                    f"WHERE message_id = ?",
                    (msg_id,),
                ).fetchall()
                attachments = [
                    AttachmentOut(
                        id=a["id"],
                        filename=a["filename"],
                        content_type=a["content_type"],
                        size=a["size"],
                        url=f"/api/files/{a['id']}",
                    )
                    for a in att_rows
                ]

            row = conn.execute(
                "SELECT id, role, content, created_at FROM messages WHERE id = ?",
                (msg_id,),
            ).fetchone()
            inserted.append(
                MessageOut(
                    id=row["id"],
                    role=row["role"],
                    content=row["content"],
                    created_at=row["created_at"],
                    attachments=attachments,
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
