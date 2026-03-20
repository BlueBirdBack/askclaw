# AskClaw IM — Security & Code Review

**Reviewer:** Claude Opus 4.6
**Date:** 2026-03-17
**Scope:** Full source review — bridge-nats.cjs, relay.cjs, all src/ files
**Build status:** CLEAN (vite v8.0.0, 178 modules, 0 errors, 0 warnings)

---

## 1. Summary

AskClaw IM is a Svelte 5 chat frontend that communicates through an HTTP/SSE bridge server (`bridge-nats.cjs`) to NATS, which routes messages to per-agent relay processes (`relay.cjs`) that connect to local gateway WebSockets. The architecture is sound but has several security issues, a critical auth race condition, and a handful of bugs in the bridge server's timeout/error handling.

---

## 2. Critical Bugs (Security / Auth)

### C1. TLS Server Identity Verification Disabled — MITM Risk
**Files:** `bridge-nats.cjs:249`, `relay.cjs:259`
```js
tlsOpts.checkServerIdentity = () => undefined;
```
Both the bridge and relay disable TLS hostname verification when connecting to NATS. An attacker who can intercept the network path (e.g., ARP spoofing on the same network, compromised router) can present any certificate signed by the CA and intercept/modify all NATS traffic — including chat messages and auth tokens. This completely undermines the purpose of using `tls://` connections.

**Fix:** Remove `checkServerIdentity` override entirely, or only set it behind an explicit `NATS_SKIP_VERIFY=1` env var for development.

### C2. `authRequired` Race Condition — Briefly Exploitable Window
**File:** `src/App.svelte:35,51,61,296`

`authRequired` starts as `null` (line 35). The composer disabled check (line 51) is:
```ts
let composerDisabled = $derived(!activeAgent || authRequired === null || (authRequired === true && !token))
```
This correctly disables the composer while `authRequired` is `null`. However, the `$effect` at line 296:
```ts
if (!token && authRequired) showTokenOverlay = true
```
...does NOT trigger while `authRequired === null` (null is falsy), so the token overlay won't appear until health resolves. If `loadBridgeHealth()` fails permanently (network error, bridge down), `authRequired` stays `null` forever — the user sees a permanently disabled composer with no explanation and no token prompt. This is a UX bug more than a security hole (the composer IS disabled), but it means users get stuck with no feedback.

**More critically**, `loadBridgeHealth` (line 61) sets:
```ts
authRequired = health.authRequired !== false
```
This means any truthy value OR `undefined` maps to `true`. If the bridge response structure ever changes, auth defaults to required (safe side). This is correct but worth documenting.

### C3. CORS Wildcard `Access-Control-Allow-Origin: *`
**File:** `bridge-nats.cjs:50`
```js
res.setHeader('Access-Control-Allow-Origin', '*');
```
The bridge accepts requests from any origin. Combined with Bearer token auth, this means:
- If a user's token is leaked or stored in a page vulnerable to XSS, **any website** can make authenticated requests to the bridge.
- A malicious page can send chat messages on the user's behalf if it knows the token.

**Fix:** Set `Access-Control-Allow-Origin` to a specific allowed origin (from env var), or at minimum reflect `Origin` header with a whitelist check.

### C4. `/bridge/agents` and `/bridge/health` Are Always Unauthenticated
**File:** `bridge-nats.cjs:74-91`

`handleHealth` and `handleAgents` never call `checkAuth()`. This leaks:
- Agent IDs, labels, and emojis to unauthenticated users
- Bridge uptime, NATS connection status, and timestamp
- Whether auth is required (`authRequired` field)

This is information disclosure. An attacker can enumerate agents and probe bridge availability without any credentials.

**Fix:** Either gate these endpoints behind auth, or explicitly document this as intentional for the self-hosted use case.

### C5. Auth Token Stored in localStorage — XSS Exfiltration Risk
**File:** `src/lib/stores/auth.ts:10,29`

The Bearer token is stored in `localStorage`, which is accessible to any JavaScript running on the same origin. While the app uses DOMPurify for markdown rendering (good), a single DOMPurify bypass or CSP gap would allow token theft. `sessionStorage` or `httpOnly` cookies would limit the blast radius.

### C6. Bridge Unauthenticated Mode Has No Warning
**File:** `bridge-nats.cjs:44-46`
```js
function checkAuth(req) {
  if (!AUTH_TOKEN) return true;  // no token configured = self-hosted trusted mode
  ...
}
```
When `AUTH_TOKEN` is empty, ALL endpoints (send, history, new) are open to any client that can reach the bridge. There's a comment saying "self-hosted trusted mode" but no log warning at startup. A misconfigured deployment could accidentally expose the bridge.

**Fix:** Log a prominent warning at startup when `AUTH_TOKEN` is empty.

### C7. SSE Data Injection via Malicious Relay
**File:** `bridge-nats.cjs:149`
```js
res.write(`data: ${raw}\n\n`);
```
The `raw` value from NATS is written directly into the SSE stream without sanitization. If a compromised relay sends a NATS message containing `\n\ndata: {"delta":"<injected>"}`, it would create an additional SSE event. While the client-side parser only processes JSON payloads (limiting XSS impact), this is a protocol-level injection that could cause confusing behavior.

**Fix:** Ensure `raw` does not contain newlines before writing, or JSON-encode the entire payload in a wrapper object.

---

## 3. Non-Critical Bugs

### N1. `handleHistory` Timeout Is Dead Code
**File:** `bridge-nats.cjs:188-192`
```js
// The for-await loop on line 179 BLOCKS until a message arrives or subscription ends.
// By the time this setTimeout is reached, the response has already been sent.
setTimeout(() => {
  if (!res.writableFinished) json(res, 504, { error: 'relay timeout' });
}, 10000);
```
The timeout is set **after** the `for await` loop exits, so it can never fire as a timeout. The response is either already sent (message received) or an error was thrown.

**Fix:** Set the timeout BEFORE the `for await` loop and clear it on success, matching the pattern used in `handleSend`.

### N2. `handleNew` Has No Timeout At All
**File:** `bridge-nats.cjs:210-213`
```js
for await (const msg of sub) {
  const data = JSON.parse(sc.decode(msg.data));
  return json(res, 200, data);
}
```
If the relay never responds, this `for await` hangs forever and the HTTP connection is never closed. There is no timeout, unlike `handleSend` (which has a 2-minute timeout).

**Fix:** Add a timeout similar to `handleHistory`'s intended pattern.

### N3. Hardcoded Absolute Path in relay.cjs
**File:** `relay.cjs:17`
```js
const WebSocket = require('/usr/lib/node_modules/openclaw/node_modules/ws/index.js');
```
This hardcoded path will break on any system where `openclaw` is installed in a different location (e.g., NVM, different distro, or local install). This should be `require('ws')` with `ws` as a proper dependency.

### N4. Fragile `require` Paths for NATS
**Files:** `bridge-nats.cjs:17`, `relay.cjs:18`
```js
const { connect, StringCodec, createInbox } = require('./node_modules/nats');
```
Using `./node_modules/nats` instead of just `'nats'` bypasses Node's module resolution. This breaks with hoisted dependencies (pnpm, yarn PnP, monorepos) and is fragile.

### N5. relay.cjs `uuid()` Uses `Math.random()`
**File:** `relay.cjs:40-44`

The UUID generator uses `Math.random()` which is not cryptographically secure. While these UUIDs are used for request IDs and idempotency keys (not security-critical), using `crypto.randomUUID()` (available in Node 19+) would be more robust.

### N6. relay.cjs `getHistory` Double-Serialization Inconsistency
**File:** `relay.cjs:211-228`

`getHistory` calls `_publishReply(subject, JSON.stringify({...}))` — passing a pre-serialized string. But `_publishReply` (line 166-169) checks `typeof data === 'string'` and sends it as-is. Meanwhile, `sendMessage` passes objects to `_publishReply`. This inconsistency works but is confusing and error-prone if someone changes `_publishReply`'s behavior.

### N7. `readBody` Does Not Reject Slow Requests
**File:** `bridge-nats.cjs:62-69`

The body size limit (65536 bytes) prevents memory bombs, but there's no request timeout. A slow client could hold a connection open indefinitely by sending 1 byte/second. Node's default `server.timeout` is 0 (disabled).

### N8. `handleSend` Subscribes Before Publish — Max 100 Messages Limit
**File:** `bridge-nats.cjs:118`
```js
const sub = nc.subscribe(inbox, { max: 100 });
```
If a relay sends more than 100 NATS messages for a single request, the subscription auto-closes and the remaining deltas are lost. This is likely fine for normal responses but could silently truncate very long ones.

---

## 4. Code Quality Issues

### Q1. Duplicated MIME Type Mappings
**Files:** `src/lib/stores/chat.ts:47-92` and `src/lib/components/Composer.svelte:25-70`

The `FILE_MIME_BY_EXTENSION` / `MIME_BY_EXTENSION` maps are identical 45-line objects duplicated in two files. Additionally, `TEXT_MIME_TYPES` and `TEXT_FILE_EXTENSIONS` in chat.ts partially overlap with the allowed-type logic in Composer.svelte.

**Fix:** Extract to a shared `src/lib/file-types.ts` module.

### Q2. `settings.ts` Calls `applyFontSize` at Module Load
**File:** `src/lib/stores/settings.ts:41-42`
```ts
const initial = load()
applyFontSize(initial.fontSize)
```
This runs at import time and touches the DOM (`document.documentElement.style.fontSize`). In an SSR context this would throw. Currently safe since the app is SPA-only, but worth noting.

### Q3. No Error Boundary
There is no top-level error boundary. An unhandled error in any component will crash the entire app with a white screen. Svelte 5 supports `$effect` cleanup but not error boundaries natively — consider a try/catch wrapper or error overlay.

### Q4. `chat.ts` Module-Level Mutable State
**File:** `src/lib/stores/chat.ts:44-45`
```ts
let messageSequence = 0
let activeController: AbortController | null = null
```
Module-level mutable state is effectively a singleton. This is fine for a SPA but makes testing difficult and would break if the module were ever imported in multiple contexts.

### Q5. TokenOverlay `onClear` Callback Not Wired
**File:** `src/lib/components/TokenOverlay.svelte:6`, `src/App.svelte:365-373`

`TokenOverlay` accepts an `onClear` prop (line 6) but `App.svelte` never passes it. The "Clear" button in the overlay calls `handleClear()` which sets `draft = ''` and calls `onClear()` — but since `onClear` defaults to a no-op, clicking "Clear" only clears the input field without actually clearing the stored token. This is likely a bug — the user expects "Clear" to remove their token.

### Q6. Unused `agentLoading` and `agentError` State
**File:** `src/App.svelte:27-28`
```ts
let agentError: string | null = $state(null)
let agentLoading = $state(false)
```
These are set from the agents store subscription but never used in the template. No loading spinner or error message is shown to the user when agents fail to load.

### Q7. `code-lang` Span Uses `escapeAttribute` for Text Content
**File:** `src/lib/markdown.ts:30`
```ts
`<span class="code-lang">${escapeAttribute(label)}</span>`
```
`escapeAttribute` is used to escape text content inside a `<span>`. While this works (HTML entity escaping is valid in text content), using a function named `escapeAttribute` for text content is semantically misleading. DOMPurify will sanitize the output regardless.

---

## 5. Build Results

```
$ npm install
found 0 vulnerabilities

$ npm run build
vite v8.0.0 building client environment for production...
✓ 178 modules transformed.
dist/index.html                   0.45 kB │ gzip:   0.29 kB
dist/assets/index-C8IJ-G9i.css   22.08 kB │ gzip:   5.13 kB
dist/assets/index-Cd_WsFbj.js   299.85 kB │ gzip: 101.89 kB

✓ built in 922ms
```

**Build: CLEAN** — no errors, no warnings, 0 vulnerabilities in npm audit.

---

## 6. Recommendations

### Priority 1 — Security Fixes (Do Now)
1. **Remove `checkServerIdentity` override** in both bridge and relay NATS connections. Use proper TLS verification.
2. **Replace CORS wildcard** with an explicit origin whitelist (`ALLOWED_ORIGIN` env var).
3. **Add startup warning** when `AUTH_TOKEN` is empty.
4. **Sanitize SSE data** — strip or escape newlines in NATS messages before writing to SSE stream.

### Priority 2 — Bug Fixes (Do Soon)
5. **Fix `handleHistory` timeout** — move `setTimeout` before the `for await` loop, clear on success.
6. **Add timeout to `handleNew`** — mirror the pattern from `handleSend`.
7. **Wire `onClear` in TokenOverlay** — when user clicks "Clear", call `authToken.clearToken()`.
8. **Fix hardcoded require paths** — use standard `require('ws')` and `require('nats')`.

### Priority 3 — Code Quality (Do Eventually)
9. Extract shared MIME type constants to a single module.
10. Show loading/error states for agent loading in the UI.
11. Add request timeout to the bridge HTTP server (`server.timeout`).
12. Consider `sessionStorage` or `httpOnly` cookies instead of `localStorage` for token storage.
13. Add a top-level error boundary or crash recovery UI.

---

*Total issues found: 7 critical/security, 8 non-critical bugs, 7 code quality issues.*
