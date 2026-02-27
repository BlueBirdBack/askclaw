import re

from fastapi import APIRouter, Depends, Query

from ..auth import get_current_user
from ..db import get_connection
from ..models import SearchResult

router = APIRouter(prefix="/search", tags=["search"])


def _highlight(text: str, query: str) -> str:
    """Case-insensitive highlight of query in text using <mark> tags."""
    escaped = re.escape(query)
    return re.sub(f"({escaped})", r"<mark>\1</mark>", text, flags=re.IGNORECASE)


def _snippet_around(text: str, query: str, context: int = 40) -> str:
    """Extract a short snippet around the first match, with <mark> highlight."""
    idx = text.lower().find(query.lower())
    if idx == -1:
        return _highlight(text[:80], query)
    start = max(0, idx - context)
    end = min(len(text), idx + len(query) + context)
    snippet = text[start:end]
    if start > 0:
        snippet = "..." + snippet
    if end < len(text):
        snippet = snippet + "..."
    return _highlight(snippet, query)


@router.get("", response_model=list[SearchResult])
def search_messages(
    q: str = Query(..., min_length=1),
    username: str = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    conn = get_connection()
    try:
        results: list[SearchResult] = []
        seen_msg_ids: set[int] = set()
        seen_chat_ids: set[str] = set()
        like_q = f"%{q}%"

        # 1) FTS5 full-text search on message content
        fts_rows = conn.execute(
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

        for r in fts_rows:
            seen_chat_ids.add(r["chat_id"])
            seen_msg_ids.add(r["message_id"])
            results.append(
                SearchResult(
                    chat_id=r["chat_id"],
                    chat_title=r["chat_title"],
                    message_id=r["message_id"],
                    role=r["role"],
                    snippet=r["snippet"],
                )
            )

        # 1b) LIKE fallback for CJK and other text FTS misses
        if len(results) < limit:
            like_rows = conn.execute(
                "SELECT m.id AS message_id, m.chat_id, c.title AS chat_title, "
                "  m.role, m.content "
                "FROM messages m "
                "JOIN chats c ON c.id = m.chat_id "
                "WHERE c.username = ? AND m.content LIKE ? COLLATE NOCASE "
                "ORDER BY m.id DESC LIMIT ?",
                (username, like_q, limit),
            ).fetchall()

            for r in like_rows:
                if r["message_id"] not in seen_msg_ids:
                    seen_msg_ids.add(r["message_id"])
                    seen_chat_ids.add(r["chat_id"])
                    # Extract a short snippet around the match
                    content = r["content"]
                    snippet = _snippet_around(content, q)
                    results.append(
                        SearchResult(
                            chat_id=r["chat_id"],
                            chat_title=r["chat_title"],
                            message_id=r["message_id"],
                            role=r["role"],
                            snippet=snippet,
                        )
                    )

        # 2) Chat title LIKE search (only chats not already matched by FTS)
        like_q = f"%{q}%"
        title_rows = conn.execute(
            "SELECT id, title FROM chats "
            "WHERE username = ? AND title LIKE ? COLLATE NOCASE "
            "ORDER BY updated_at DESC LIMIT ?",
            (username, like_q, limit),
        ).fetchall()

        for r in title_rows:
            if r["id"] not in seen_chat_ids:
                seen_chat_ids.add(r["id"])
                results.append(
                    SearchResult(
                        chat_id=r["id"],
                        chat_title=r["title"],
                        message_id=0,
                        role="title",
                        snippet=_highlight(r["title"], q),
                    )
                )

        # 3) Attachment filename LIKE search
        att_rows = conn.execute(
            "SELECT a.filename, a.message_id, m.chat_id, c.title AS chat_title "
            "FROM attachments a "
            "JOIN messages m ON m.id = a.message_id "
            "JOIN chats c ON c.id = m.chat_id "
            "WHERE a.username = ? AND a.filename LIKE ? COLLATE NOCASE "
            "ORDER BY a.created_at DESC LIMIT ?",
            (username, like_q, limit),
        ).fetchall()

        for r in att_rows:
            if r["chat_id"] not in seen_chat_ids:
                seen_chat_ids.add(r["chat_id"])
                results.append(
                    SearchResult(
                        chat_id=r["chat_id"],
                        chat_title=r["chat_title"],
                        message_id=r["message_id"],
                        role="file",
                        snippet=_highlight(r["filename"], q),
                    )
                )

        return results[:limit]
    finally:
        conn.close()
