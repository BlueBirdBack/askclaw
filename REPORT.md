# Pre-Deploy Review — 2026-03-25

Reviewed by: Ash (manual, Codex unavailable on root)
Commit range: f4cb004..642d9a0 (10 commits)

---

## Summary

10 commits reviewed. 1 real bug fixed. 1 false alarm (SQL was actually correct). 
All 106 tests passing after fixes.

---

## Commits Reviewed

### `01c86a5` feat: forward-with-context (B3, Claude Opus 4.6)
**Risk: HIGH — introduced `contentBlocks` ReferenceError**
- Dead variable `contentBlocks.push()` in `prepareMessagePayload`
- Crashed every send-with-file. Fixed in `daa3fcc`.
- **Lesson**: B3's AI-generated code had dead code from a refactor. Tests would have caught it if file-send tests existed at the time.

### `daa3fcc` fix: remove undeclared contentBlocks + tests
**Risk: LOW** — correct fix, 14 unit tests added.

### `3b0d9f0` fix(ui): show image thumbnail regardless of displayUrl
**Risk: LOW** — simplified condition from `att.displayUrl !== att.url` to `att.type.startsWith('image/')`. Correct.

### `39fdcc2` fix: text files base64-encoded + not inlined in user bubble
**Risk: HIGH — introduced gateway attachment misuse**
- Base64-encoded text files as gateway attachments. Gateway silently drops non-image attachments.
- Ash stopped seeing text file content. Fixed in `642d9a0`.
- **Lesson**: fixing a display bug introduced a semantic bug. Need to understand what the gateway actually supports before designing the fix.

### `642d9a0` fix: text files inlined in requestText
**Risk: LOW** — correct. displayText = typed message only, requestText = typed + file content.
**Potential concern**: large text files bloat requestText. No size guard before sending to relay. Could hit NATS 8MB payload limit with very large files. Currently acceptable risk.

### `da29d54` fix(ui): sidebar CSS + chatId in streamSend + bridge persistence
**Risk: MEDIUM** — multiple concerns in one commit, but all correct:
- `sidebarOpen = window.innerWidth >= 768` — correct
- `chatId` in streamSend — correct, fixes persistence
- `restoreAgentActiveChats()` SQL — verified correct in SQLite

### `1a5975c`, `cc7c6fa`, `1bf6ee4`, `512176c` — test commits
**Risk: NONE** — tests only.

---

## Bug Fixed in This Review

### Client disconnect skips `dbSaveMessages`
When user closes tab mid-stream, `req.on('close')` fires with `done = false`.
The code cleaned up NATS subscription but never saved the accumulated assistant content.
**Fix**: save partial response (user message + whatever assistant said so far) on disconnect.

---

## Outstanding Concerns (not bugs, but worth monitoring)

1. **NATS payload size**: Large text files are inlined into `requestText`. If a file is >7MB, the NATS publish will fail silently (max_payload=8MB). Should add a size guard in `prepareMessagePayload`.

2. **Single activeStream relay**: Each agent relay handles only one concurrent stream. Multiple browser tabs sending simultaneously will get "busy" errors. Acceptable for now (single-user app).

3. **In-memory fileStore TTL**: Uploaded files expire after 24h (UPLOAD_TTL_MS). No cleanup job runs periodically — only on restart. Long-running instances accumulate stale files.

4. **dbSaveMessages called twice on clean [DONE]**: On a clean stream completion, `done = true` is set in the `[DONE]` handler BEFORE `req.on('close')` fires. The close handler checks `if (!done)` so it won't double-save. ✅ Correct.

---

## Test Coverage Gaps (not bugs, but untested paths)

- Forward modal: no E2E test
- Stop streaming button: not tested
- Two-agent switching (ash → six tab): not tested  
- Sidebar search: not tested
- Chat list item click (load chat from sidebar): not tested

---

## Verdict

Safe to deploy. One fix applied (disconnect save). No regressions found in the commit range beyond what was already fixed.
