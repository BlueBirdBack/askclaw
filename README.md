# AskClaw

> The web UI OpenClaw should have shipped with.  
> Solves [15 of 22 top user pain points](https://github.com/BlueBirdBack/openclaw-pain-points) by design.  
> Self-hosted · MIT License

![Desktop](docs/screenshots/chat-light.png)

**English** · [中文](README.zh.md)

---

## Why AskClaw exists

OpenClaw is powerful but painful to use as a chat interface. Users report [22 major pain points](https://github.com/BlueBirdBack/openclaw-pain-points) — from $600/month API bills to 3.2-hour install times to silent data loss. AskClaw sidesteps 15 of them:

| OpenClaw pain | AskClaw fix |
|---|---|
| $100–600/mo API costs (150K-token system prompts, $36/day heartbeats) | Clean API calls — no bloated context, no background polling |
| 3.2-hour median install time | `pip install` + `npm install` — done |
| Memory compaction silently deletes work | SQLite persistence + full-text search — nothing disappears |
| Gateway token auth failures (WS 1008) | nginx Basic Auth — no tokens, no device pairing |
| Config drift across CLI/service/auth files | One `.env` file |
| "Bot online but silent" channel permission maze | AskClaw IS the UI — no Telegram/Discord config needed |
| Remote access needs SSH/Tailscale tunnels | Standard HTTPS — just a URL |

AskClaw is a self-hosted AI chat interface for teams who want AI chat without the pain. Works with OpenAI or any OpenAI-compatible endpoint — including [OpenClaw](https://github.com/openclaw/openclaw).

## Features

- 💬 **Real-time streaming chat** — responses stream as they're generated
- 👥 **Multi-user** — per-user isolated sessions, shared infrastructure
- 📄 **Export** — save conversations as PDF or DOCX
- 🌐 **Bilingual** — English + Chinese (i18n built-in)
- 📱 **Responsive** — desktop, tablet, and mobile
- 🔍 **Search** — full-text search across all conversations (SQLite FTS5)
- 🔌 **Model-agnostic** — OpenAI API or any OpenAI-compatible endpoint
- 🔒 **Auth** — HTTP Basic Auth with per-user session isolation

## Screenshots

| Code highlighting | Markdown tables |
|---|---|
| ![Code](docs/screenshots/chat-light.png) | ![Tables](docs/screenshots/chat2-light.png) |

| Full-text search | Dark mode | Mobile |
|---|---|---|
| ![Search](docs/screenshots/search-light.png) | ![Dark](docs/screenshots/chat-dark.png) | ![Mobile](docs/screenshots/mobile.png) |

## Stack

| Layer | Technology |
|---|---|
| Frontend | Svelte 5 + TypeScript + Vite |
| Backend | FastAPI + Python 3.13 |
| Database | SQLite (WAL mode, FTS5 full-text search) |
| Auth | HTTP Basic Auth (htpasswd) |
| Export | PDF (html2pdf) + DOCX (docx.js) |
| i18n | Custom (en + zh) |

## Architecture

```
Browser
  └─▶ nginx (TLS termination + Basic Auth)
        ├─▶ FastAPI backend (:8000)  ← chat history, files, search
        └─▶ AI provider             ← OpenAI / OpenClaw / any compatible endpoint
```

Each user gets an isolated session. The backend stores conversations in SQLite with full-text search. The AI provider is configurable — swap it by changing one environment variable.

## Quick Start

### Prerequisites
- Python 3.13+
- Node.js 18+
- An OpenAI-compatible API endpoint

### Backend

```bash
cd server
python -m venv .venv && source .venv/bin/activate
pip install -e .
uvicorn askclaw.main:app --host 127.0.0.1 --port 8000
```

### Frontend

```bash
npm install
npm run dev        # development
npm run build      # production → dist/
```

### Environment

```bash
# Copy the example and edit
cp server/.env.example server/.env
```

**Default (OpenAI / OpenClaw):**
```bash
ASKCLAW_OPENCLAW_CONFIG=/root/.openclaw/openclaw.json
```

### OpenClaw agent

AskClaw uses a dedicated OpenClaw agent (`openclaw:askclaw`) with a minimal workspace to prevent the main agent's system prompt from leaking into user responses. See [`docs/openclaw-agent.md`](docs/openclaw-agent.md) for full setup details.

### Production (nginx)

See [`nginx-config-example`](docs/nginx.md) for a full nginx + TLS setup with Basic Auth.

## Project Structure

```
/
├── src/                    # Svelte 5 frontend
│   ├── components/         # Chat UI components
│   └── lib/               # API client, i18n, export, state
├── server/
│   └── askclaw/           # FastAPI backend
│       ├── routers/       # API routes (chats, files, auth, search)
│       ├── main.py        # App entry point
│       ├── models.py      # Pydantic models
│       └── db.py          # SQLite + FTS5
└── public/                # Static assets
```

## Live Demo

[askclaw.top](https://askclaw.top) — demo deployment.

## Roadmap

- [ ] Docker Compose setup
- [ ] Multi-model selection per chat
- [ ] Team/organization support
- [ ] Usage analytics dashboard

## License

MIT — see [LICENSE](LICENSE)

## Built with

- [OpenClaw](https://github.com/openclaw/openclaw) — multi-agent AI framework powering the backend
- [Svelte](https://svelte.dev) — frontend framework
- [FastAPI](https://fastapi.tiangolo.com) — backend framework
