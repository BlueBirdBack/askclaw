# AskClaw IM

**Agent-native IM for one-person companies & teams. Built for OpenClaw, by OpenClaw.**

![AskClaw IM — Desktop](docs/screenshot.jpg)

<p align="center">
  <img src="docs/screenshot-mobile.jpg" width="300" alt="AskClaw IM — Mobile" />
</p>

## What is this?

AskClaw IM is an open-source instant messaging interface where AI agents are first-class citizens — not sidebar tools, but teammates.

- 🤖 **Multi-agent chat** — talk to multiple agents, each with independent context
- ↗️ **One-tap forward** — forward any agent's reply to another agent
- 💬 **Real-time streaming** — SSE-powered, see responses as they're generated
- 📎 **File attachments** — drag, paste, or click to upload, 25+ formats
- 📁 **Chat history** — search, browse, and export all conversations
- 🌓 **Dark/light theme** — follows your system preference
- 📱 **Mobile-friendly** — works on your phone

## Architecture

```
Browser → HTTPS → Bridge → NATS → Relay → OpenClaw Gateway → Agent
                                    ← NATS ← Relay ← Gateway ←
```

- **Frontend**: Svelte 5 + TypeScript + Vite
- **Bridge**: Node.js HTTP/SSE server, translates browser requests → NATS messages
- **Relay**: Runs on each agent's machine, bridges NATS ↔ OpenClaw Gateway WebSocket
- **Message bus**: NATS (replaceable with other message brokers)

## Quick Start

### Prerequisites

- Node.js ≥ 22
- A running [OpenClaw](https://github.com/openclaw/openclaw) instance
- NATS server (recommended; direct gateway connection also works)

### 1. Clone and install

```bash
git clone https://github.com/BlueBirdBack/askclaw.git
cd askclaw
npm install
```

### 2. Configure agents

Edit `agents.json`:

```json
{
  "my-agent": {
    "label": "My Agent",
    "emoji": "🤖",
    "gateway": "ws://127.0.0.1:18789/",
    "token": "YOUR_OPENCLAW_TOKEN",
    "origin": "https://your-domain.com"
  }
}
```

### 3. Start the bridge

```bash
# Direct mode (no NATS needed)
node bridge-nats.cjs

# Full mode (via NATS)
NATS_URL=tls://127.0.0.1:4222 NATS_USER=user NATS_PASS=pass node bridge-nats.cjs
```

### 4. Start the frontend

```bash
npm run dev
```

Open http://localhost:5173 and start chatting.

### 5. Production deployment

```bash
npm run build
# Deploy dist/ to any static server (nginx, Caddy, Cloudflare Pages)
# Run bridge-nats.cjs as a backend service
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Bridge listen port |
| `NATS_URL` | `tls://127.0.0.1:4222` | NATS server address |
| `NATS_USER` | — | NATS username |
| `NATS_PASS` | — | NATS password |
| `NATS_CA` | `/etc/nats/certs/ca.pem` | TLS CA certificate path |
| `AGENT` | — | Relay mode: target agent ID |
| `GATEWAY_ORIGIN` | `http://127.0.0.1:18789` | Relay mode: OpenClaw gateway URL |

## Why not DingTalk / Feishu / Slack?

They were built for **human-to-human** collaboration. AI was bolted on later.

AskClaw IM is **agent-native** — agents aren't sidebar bots, they're first-class participants in the conversation. Your people use Feishu. Your agents use AskClaw. They bridge to each other.

## Enterprise

Need agent-native IM deployed for your team?

- Self-hosted deployment + custom integration
- Bridge into existing IM (Feishu, DingTalk, WeCom)
- Contact: [BlueBirdBack](https://github.com/BlueBirdBack)

## Stack

- [Svelte 5](https://svelte.dev/) — frontend framework
- [Vite](https://vitejs.dev/) — build tool
- [NATS](https://nats.io/) — message bus
- [OpenClaw](https://github.com/openclaw/openclaw) — AI agent runtime

## License

[MIT](LICENSE)

---

[中文](./README.md)
