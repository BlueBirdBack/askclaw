# TODOS

## Forward preview/confirmation
- **What:** Add preview step before auto-sending forwarded messages
- **Why:** Misfire permanently pollutes target agent's session with large context message. No undo.
- **Context:** Currently auto-sends immediately after agent selection in ForwardModal. A preview modal showing formatted context with Send/Cancel would prevent mistakes. Flagged by outside voice during eng review (2026-03-25).
- **Depends on:** Forward-with-context feature

## SQLite persistence
- **What:** Implement SQLite (WAL mode) for chat history persistence
- **Why:** All sessions are in-memory — closing tab loses everything. Critical for "daily driver" success criterion. Bridge has stubbed endpoints (`/bridge/chats` returns `[]`).
- **Context:** Design doc specifies schema: conversations (id, name, created_at), messages (id, conversation_id, agent_id, role, content, forwarded_from, created_at), agents (id, name, role, gateway_path, status). See design doc at `~/.gstack/projects/askclaw/root-unknown-design-20260324-192204.md`.
- **Depends on:** Forward-with-context feature — validate workflow before adding persistence
