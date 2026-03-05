# OpenClaw Agent Setup for AskClaw

AskClaw uses [OpenClaw](https://github.com/openclaw/openclaw) as its default AI backend via the `/v1/responses` endpoint. To prevent the main OpenClaw agent's system prompt (heartbeat rules, NO_REPLY signals, personal memory, group chat behavior) from leaking into AskClaw responses, AskClaw must be wired to a **dedicated, minimal agent**.

## Why a dedicated agent

The main OpenClaw agent (e.g. "Ash") is a personal AI assistant. Its system prompt includes:

- `NO_REPLY` — silent reply signal for group chats (shows as "无回复" to AskClaw users if unfiltered)
- `HEARTBEAT_OK` — heartbeat acknowledgement
- Personal memory files (MEMORY.md, USER.md, etc.)
- Group chat and heartbeat behavior rules

If AskClaw calls `/v1/responses` targeting the main agent, all of the above bleeds into user-facing responses.

## Configuration

### 1. OpenClaw agent definition (`~/.openclaw/openclaw.json`)

```json
{
  "agents": {
    "list": [
      {
        "id": "askclaw",
        "workspace": "/root/.openclaw/workspace-askclaw",
        "tools": {
          "profile": "minimal"
        }
      }
    ]
  }
}
```

- `id: "askclaw"` — the agent name used in the model string `openclaw:askclaw`
- `workspace` — points to a dedicated directory with a clean system prompt (see below)
- `tools.profile: "minimal"` — no file/exec/browser tools; agent answers only

### 2. Dedicated workspace (`~/.openclaw/workspace-askclaw/AGENTS.md`)

```markdown
# AskClaw Assistant

You are AskClaw, a helpful AI assistant. Your only job is to answer user questions clearly, helpfully, and concisely.

## Rules

- Always respond to every message with a real, useful answer.
- Never say "NO_REPLY", "HEARTBEAT_OK", or any other internal signal.
- Never refuse to answer based on context — treat every message as a genuine user question.
- Do not reference memory, files, or previous sessions.
- Do not act as a personal assistant or agent — just answer questions.
- Keep responses focused and to the point.
- Support all languages — respond in the same language the user writes in.
```

### 3. Frontend model string (`src/lib/state.svelte.ts`)

```ts
model: Model = $state('openclaw:askclaw');
```

The model string `openclaw:<agent-id>` tells the OpenClaw gateway which agent to route the request to.

### 4. Surface-level filter (`src/App.svelte`)

Even with a dedicated agent, OpenClaw injects `NO_REPLY` handling at the runtime level. The frontend filters it as a safety net:

```ts
onDone(full) {
  // Strip OpenClaw internal signals — treat as empty response
  const trimmed = full.trim();
  if (trimmed === 'NO_REPLY' || trimmed === 'HEARTBEAT_OK') full = '';
  if (!full) {
    chatState.updateLastAssistant(`*${t(chatState.lang, 'noResponse')}*`);
  }
  // ...
}
```

## Applying changes

After editing `openclaw.json` or the workspace files, restart the gateway:

```bash
openclaw gateway restart
```

## Summary

| Layer | What it does |
|---|---|
| `openclaw.json` agent entry | Routes `openclaw:askclaw` to a dedicated workspace |
| `workspace-askclaw/AGENTS.md` | Clean system prompt — no NO_REPLY, no personal memory |
| Frontend model string | Targets the right agent |
| `onDone` filter | Safety net in case runtime-level signals slip through |
