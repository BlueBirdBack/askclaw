# AskClaw IM Layer 1 — Frontend Anvil Reference

## What Layer 1 Is

The Svelte SPA that users interact with at askclaw.buzz. It talks to the bridge at `/bridge/*`.

## Files Under Review

```
src/
  App.svelte              — root component, orchestrates all state + handlers
  main.ts                 — entry point
  lib/
    api.ts                — all bridge HTTP calls
    types.ts              — shared types
    compress.ts           — image compression utility
    export.ts             — chat export (markdown/text/json)
    markdown.ts           — markdown rendering
    stores/
      auth.ts             — localStorage token store
      agents.ts           — agent list store
      chat.ts             — chat state machine (sessions, streaming, history)
      settings.ts         — font size + locale, localStorage persisted
    components/
      ChatArea.svelte     — message list + scroll management
      Composer.svelte     — text input + file attach + send/stop
      EmptyState.svelte   — shown when no messages
      ForwardModal.svelte — cross-agent message forwarding dialog
      Message.svelte      — individual message bubble + markdown
      Sidebar.svelte      — chat history sidebar
      StatusDot.svelte    — connection status indicator
      TabBar.svelte       — agent tabs + export + settings buttons
      TokenOverlay.svelte — token entry/clear overlay
```

## Bridge API Contract (what the frontend expects)

### Implemented (bridge-nats.cjs)
- `GET /bridge/health` → `{ status, agents[], authRequired, uptime, ts }`
- `GET /bridge/agents` → `BridgeAgent[]` — `{ id, label, emoji? }`
- `POST /bridge/send` → SSE stream — events: `{ delta }` / `{ chatId }` / `{ error }` / `[DONE]`
- `GET /bridge/history?agent=X` → `{ ok, agent_id?, chat_id?, payload: { messages[] }, title? }`
- `POST /bridge/new` → `{ ok, chatId? }`

### Stub-only (returns empty/ok, no real data)
- `GET /bridge/chats` → `[]`
- `GET /bridge/chats/:id` → `null`
- `DELETE /bridge/chats/:id` → `{ ok: true }`
- `POST /bridge/chats/:id/load` → `{ ok: true }`
- `GET /bridge/search?q=X` → `[]`
- `POST /bridge/forward` → `501 not implemented`

## Key Behaviours

### Auth flow
1. On init: `getHealth()` → sets `authRequired`
2. If `authRequired && !token`: show TokenOverlay, block composer
3. Token stored in `localStorage` key `askclaw_token`
4. Token sent as `Authorization: Bearer <token>` header on all requests

### Startup sequence
1. `loadBridgeHealth()` → sets authRequired + status
2. If auth ok: `agents.load(token)` → populates tabs
3. `chat.syncAgents(ids)` → creates per-agent sessions
4. `chat.loadHistory(agentId, token)` → loads messages for current agent
5. `refreshChats()` → populates sidebar

### Streaming (sendMessage)
1. User message + empty assistant placeholder pushed to state
2. `streamSend()` → SSE reader loop
3. Each `{ delta }` event: appended to streaming message (`content = delta` — NOT accumulated, delta IS the full content so far per relay protocol)
4. `[DONE]` → finishStream()
5. On error/abort: placeholder removed if empty

### Delta accumulation bug note
The relay sends `{ delta: text }` where `text` is incremental chunks.
The chat store does: `streamingMessage.content = delta` (assignment, not append).
This means each delta **replaces** the previous content rather than accumulating.
This is either: (a) intentional if relay sends full accumulated text on each event,
or (b) a bug if relay sends incremental chunks.
Current relay sends incremental chunks → this is a DATA_LOSS bug in the store.

### File handling
- Max 5 files, 50MB each
- Images compressed before send (compress.ts)
- Text files: read as text, prepended to message
- Images: read as base64, sent as content blocks
- Other: placeholder note in message

### Session key in bridge/send
`streamSend` sends `agent` field. Bridge looks up subject `askclaw.chat.${agentId}.request`.
The relay maps this to `sessionKey: this.sessionKey` (resolved from HelloOk).

### Auth token on bridge
Bridge `AUTH_TOKEN` env is not set → trusted mode (no auth check).
So `authRequired = false` from health check → TokenOverlay never shown.

## Known Accepted Gaps (deferred)
- Chat history sidebar (stubs return [])
- Search (stub returns [])  
- Cross-agent forwarding (stub returns 501)
- History persistence (relay fakes empty history)
