# AskClaw — Svelte 5 Chat UI + Python Backend

## What is this?

A ChatGPT-style web UI for the OpenClaw API (Claude-based) with a FastAPI backend for chat persistence. Replaces the vanilla HTML version at `/var/www/askclaw/`.

## Tech stack

### Frontend
- **Svelte 5** (runes mode — `$state`, `$props`, `$effect`, `$derived`)
- **Vite** (plain SPA, no SvelteKit)
- **TypeScript**
- **marked** for markdown rendering (GFM, breaks: true)
- **npm** as package manager

### Backend
- **Python 3.11+**, **FastAPI**, **SQLite** (WAL mode, FTS5)
- **uv** as package manager
- **bcrypt** for htpasswd password changes
- Raw SQL (no ORM)

## Project structure

```
src/
  main.ts                     # Svelte 5 mount()
  App.svelte                  # Root layout, orchestrates send flow
  app.css                     # Global CSS: theme vars, reset, markdown typography
  lib/
    types.ts                  # TypeScript interfaces
    i18n.ts                   # zh/en translation dictionaries
    state.svelte.ts           # ChatState singleton class ($state runes)
    markdown.ts               # marked configuration
    api.ts                    # fetchUsername(), streamChat() SSE, chat persistence API
    export.ts                 # exportChatAsMarkdown() — blob download
  components/
    Header.svelte             # Title, lang toggle, new-chat, export button
    Welcome.svelte            # Centered welcome screen
    MessageList.svelte        # Scrollable container with auto-scroll
    MessageBubble.svelte      # Single message bubble with per-message copy button
    TypingIndicator.svelte    # Three-dot bounce animation
    ChatInput.svelte          # Model select, auto-grow textarea, send button
    WarningBanner.svelte      # Floating badge (bottom-right) + popover warning
    TosModal.svelte           # Full-screen Terms of Service modal

server/
  pyproject.toml              # Python dependencies (FastAPI, uvicorn, bcrypt)
  askclaw/
    __init__.py
    main.py                   # FastAPI app, lifespan, router mounts
    config.py                 # Settings via env vars (ASKCLAW_DB_PATH, ASKCLAW_HTPASSWD_PATH)
    auth.py                   # Depends() — extract username from X-Forwarded-User / Basic auth
    db.py                     # SQLite connection (WAL, foreign keys), init_db()
    schema.sql                # DDL: categories, chats, messages, tags, chat_tags, messages_fts
    models.py                 # Pydantic request/response schemas
    routers/
      __init__.py
      chats.py                # CRUD chats + append messages
      categories.py           # CRUD categories
      tags.py                 # CRUD tags
      search.py               # FTS5 full-text search
      password.py             # Change htpasswd password
```

## Key patterns

- **State**: Single `ChatState` class in `state.svelte.ts` with `$state` fields. Exported as singleton `chatState`. Components import and read/write fields directly.
- **CSS**: Theme variables + markdown typography in global `app.css` (needed for `{@html}` content). Component layout in scoped `<style>` blocks.
- **System prompt**: `streamChat()` prepends a system message with the current date/time in Asia/Taipei (UTC+8) so the LLM knows the user's timezone.
- **Streaming**: SSE logic in `api.ts` with callbacks. Mutating `$state` object properties triggers reactivity.
- **i18n**: `t(lang, key)` function with static dictionaries. Language stored in localStorage.
- **Chat persistence**: On first message, frontend generates a UUID and creates a chat via `POST /api/chats`. After each stream completes, user + assistant messages are saved via `POST /api/chats/{id}/messages`. Title is auto-generated from the first user message.
- **Auth**: nginx does basic auth and sets `X-Forwarded-User`. Backend reads this header to scope all data per-user.
- **Database**: Raw SQL with SQLite WAL mode. FTS5 external content table synced via triggers for full-text search.

## Commands

```bash
# Frontend
npm run dev        # Start dev server (port 5173, proxies /api to :8000)
npm run build      # Build to dist/
npm run preview    # Preview production build

# Backend
cd server
uv sync                                              # Install dependencies
uv run uvicorn askclaw.main:app --reload --port 8000  # Dev server
```

## Deploy

```bash
# Frontend
npm run build
cp -r dist/* /var/www/askclaw/

# Backend — run as systemd service
# See /etc/systemd/system/askclaw.service
```

Production is served at https://askclaw.top/ behind nginx. Nginx proxies `/v1/chat/completions` and `/whoami` to the OpenClaw API, and `/api/` to the FastAPI backend on port 8000.

### Nginx config (relevant bits)

```nginx
proxy_set_header X-Forwarded-User $remote_user;

location /api/ {
    proxy_pass http://127.0.0.1:8000;
}
```

## API endpoints (all under `/api/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/chats` | List chats (paginated, filterable by category_id, tag_id) |
| POST | `/chats` | Create chat (client sends UUID id + model) |
| GET | `/chats/{id}` | Get chat with all messages |
| PATCH | `/chats/{id}` | Update title, category, tags |
| DELETE | `/chats/{id}` | Delete chat + messages (CASCADE) |
| POST | `/chats/{id}/messages` | Append messages (batch: user + assistant) |
| GET | `/categories` | List categories |
| POST | `/categories` | Create category |
| PATCH | `/categories/{id}` | Update category |
| DELETE | `/categories/{id}` | Delete category |
| GET | `/tags` | List tags |
| POST | `/tags` | Create tag |
| PATCH | `/tags/{id}` | Update tag |
| DELETE | `/tags/{id}` | Delete tag |
| GET | `/search?q=...` | FTS5 search with highlight snippets |
| POST | `/password` | Change htpasswd password |

## Conventions

- Svelte 5 runes only — no legacy `$:`, `export let`, stores, or `createEventDispatcher`
- Props via `$props()`, events via callback props (e.g., `onsend`)
- No SvelteKit — this is a pure SPA
- Keep components small and focused
- Backend uses raw SQL — no ORM
- All backend data is scoped per-user via the auth dependency
