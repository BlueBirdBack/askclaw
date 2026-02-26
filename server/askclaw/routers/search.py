from fastapi import APIRouter, Depends, Query

from ..auth import get_current_user
from ..db import get_connection
from ..models import SearchResult

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=list[SearchResult])
def search_messages(
    q: str = Query(..., min_length=1),
    username: str = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT "
            "  fts.chat_id, "
            "  c.title AS chat_title, "
            "  fts.rowid AS message_id, "
            "  m.role, "
            "  highlight(messages_fts, 0, '<mark>', '</mark>') AS snippet "
            "FROM messages_fts fts "
            "JOIN chats c ON c.id = fts.chat_id "
            "JOIN messages m ON m.id = fts.rowid "
            "WHERE messages_fts MATCH ? AND c.username = ? "
            "ORDER BY rank "
            "LIMIT ? OFFSET ?",
            (q, username, limit, offset),
        ).fetchall()

        return [
            SearchResult(
                chat_id=r["chat_id"],
                chat_title=r["chat_title"],
                message_id=r["message_id"],
                role=r["role"],
                snippet=r["snippet"],
            )
            for r in rows
        ]
    finally:
        conn.close()
