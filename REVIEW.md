# AskClaw IM Security Review

**Reviewer:** Independent (post-Six audit)
**Scope:** Commits 476d6dc through cfeecb0 (7 security fixes)
**Files reviewed:** bridge-nats.cjs, relay.cjs, src/App.svelte, src/lib/api.ts, src/lib/stores/auth.ts, src/lib/stores/settings.ts, src/lib/stores/agents.ts, src/lib/stores/chat.ts, src/lib/components/*.svelte, src/app.css, DEPLOY.md
**Date:** 2026-03-17

---

## Part 1 — C1–C7 Fix Verification

### C1 — TLS `checkServerIdentity` removed (not just commented out)

**PASS**

Commit 476d6dc removes `tlsOpts.checkServerIdentity = () => undefined;` from both `bridge-nats.cjs` and `relay.cjs`. The lines are deleted entirely, not commented out. Both files now rely on the Node.js default TLS hostname verification. The fix is correct.

---

### C2 — `authRequired` fallback when health fails

**PASS** *(with a documented security tradeoff)*

Commit f780d40 changes the catch block in `loadBridgeHealth()`:

```js
// before: empty catch (authRequired stayed null forever)
// after:
} catch {
  authRequired = false
}
```

Setting `authRequired = false` on health failure lets the UI attempt unauthenticated access to the bridge. If the bridge also has `AUTH_TOKEN` unset, this is correct behaviour. If the bridge has `AUTH_TOKEN` set but the health endpoint is temporarily unreachable (e.g. transient 5xx or MITM dropping /health), the client silently proceeds as if auth is not required, skips the token prompt, and then gets 401s from all real endpoints — resulting in a degraded but non-exploitable state. The tradeoff is acceptable for a self-hosted tool where TLS termination is controlled by the operator. Noted here for transparency.

---

### C3 — CORS restricted to `CORS_ORIGIN` env var

**PASS**

Commit 6c32da1 replaces the wildcard `Access-Control-Allow-Origin: *` with:

```js
function cors(res) {
  if (!CORS_ORIGIN) return;          // ← no CORS headers when unset
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}
```

When `CORS_ORIGIN` is not set, no CORS headers are emitted — same-origin only. When set, a single exact origin is reflected. `Vary: Origin` is correctly added to prevent incorrect CDN caching. Fix is correct.

---

### C4 — `/bridge/agents` requires auth when `AUTH_TOKEN` is set

**PASS**

Commit ea2c92a adds `if (!checkAuth(req)) return json(res, 401, { error: 'unauthorized' });` as the first line of `handleAgents()`. `checkAuth()` returns `true` when `AUTH_TOKEN` is empty (trusted mode) and checks `Authorization: Bearer <token>` otherwise. Logic is correct. The API client (`getAgents`) was also updated to pass the token in all callers.

---

### C5 — Token not logged in errors

**PASS**

Commit 8d4c1b3 introduces `redactSensitiveAuth()` in `src/lib/stores/auth.ts` and applies it in:

- `src/lib/api.ts` — `parseError()`, both `streamSend()` error-throw sites
- `src/lib/stores/agents.ts` — `toErrorMessage()`
- `src/lib/stores/chat.ts` — `toErrorMessage()`
- `src/App.svelte` — `handleForwardConfirm()` error path

The redaction function strips the literal token value, `Bearer <value>` patterns, and URL query-string token patterns. The implementation is thorough. No `console.log` or `console.error` calls in the frontend code touch the token directly.

---

### C6 — Warning logged when `AUTH_TOKEN` empty

**PASS**

Commit a4a5aad adds to `main()` in `bridge-nats.cjs`:

```js
if (!AUTH_TOKEN) {
  log('⚠️ AUTH_TOKEN not set — running in trusted mode (no authentication). Set AUTH_TOKEN env var to enable auth.');
}
```

Warning is emitted at startup. Clearly visible in `journalctl` output. Fix is correct.

---

### C7 — SSE data sanitized (newlines escaped)

**PASS**

Commit cfeecb0 adds:

```js
function sanitizeSseData(data) {
  return String(data).replace(/[\r\n]/g, ' ');
}
function writeSseData(res, data) {
  res.write(`data: ${sanitizeSseData(data)}\n\n`);
}
```

All three `res.write()` call sites in `handleSend()` were replaced with `writeSseData()`. Both `\r` and `\n` are collapsed to spaces, preventing SSE frame injection. Fix is correct.

---

## Part 2 — New Issues Found

### N1 — `agents.json` not in `.gitignore` — SECRET LEAK RISK

**Severity: HIGH**

`agents.json` contains `GATEWAY_TOKEN` values (OpenClaw bearer tokens). This file is **not listed in `.gitignore`**. Any operator who follows the DEPLOY.md guide to populate `agents.json` with real credentials and then runs `git add .` will commit live secrets to their repository.

`agents.example.json` exists but `agents.json` (the live file) is tracked by git and already committed with placeholder values. The pattern is dangerous: operators expect to edit `agents.json` in place, and git will silently track those changes.

**Fix:** Add `agents.json` to `.gitignore` and update DEPLOY.md to note this.

---

### N2 — `handleNew()` has no timeout — connection hangs forever

**Severity: HIGH**

`handleNew()` in `bridge-nats.cjs` uses `for await (const msg of sub)` with `max: 1` but no timeout guard:

```js
const sub = nc.subscribe(inbox, { max: 1 });
nc.publish(subject, sc.encode(JSON.stringify({ type: 'new' })), { reply: inbox });

for await (const msg of sub) {   // hangs if relay never replies
  const data = JSON.parse(sc.decode(msg.data));
  return json(res, 200, data);
}
// no timeout here
```

If the relay is offline or slow, the HTTP connection hangs open indefinitely. Repeated "new chat" clicks from a client can exhaust the server's open connection pool. Compare with `handleHistory()` which has a 10-second `setTimeout` guard.

`handleSend()` correctly has a 120-second timeout. `handleNew()` has none.

**Fix:** Add a timeout (e.g. 10 s) identical to `handleHistory()`.

---

### N3 — `handleNew()` lacks `try/catch` around `JSON.parse`

**Severity: MEDIUM**

```js
for await (const msg of sub) {
  const data = JSON.parse(sc.decode(msg.data));  // ← no try/catch
  return json(res, 200, data);
}
```

If the relay sends malformed JSON, `JSON.parse` throws synchronously inside the `for await`. The exception propagates up to the outer `http.createServer` catch-all, which catches it and sends `500 internal error`. This is handled, but it means an invalid response from a relay can poison the "new chat" flow silently. Compare with `handleHistory()` which wraps the loop in `try/catch`. The inconsistency is a code-quality bug that can mask relay bugs.

**Fix:** Wrap the `for await` in `handleNew()` with a `try/catch`.

---

### N4 — DEPLOY.md example `systemd` services omit `AUTH_TOKEN` and `GATEWAY_TOKEN`

**Severity: MEDIUM**

The example `askclaw-bridge.service` unit does not include `AUTH_TOKEN`, meaning any operator who copy-pastes the unit file will run the bridge in unauthenticated trusted mode. The C6 warning will fire, but many operators won't read logs. Similarly, the `askclaw-relay@.service` unit omits `GATEWAY_TOKEN`, so relay-to-gateway authentication will silently fail or use an empty token.

The env-vars table in DEPLOY.md documents these, but the concrete service examples — the most likely thing an operator copies — don't set them.

**Fix:** Add commented-out `AUTH_TOKEN` and `GATEWAY_TOKEN` placeholders to the example `[Service]` blocks.

---

### N5 — DEPLOY.md uses `nats://` (plaintext) in example services, contradicting the code default of `tls://`

**Severity: MEDIUM**

The code defaults:
```js
const NATS_URL = process.env.NATS_URL || 'tls://127.0.0.1:4222';
```

But the example `systemd` units in DEPLOY.md set:
```
Environment=NATS_URL=nats://127.0.0.1:4222
```

`nats://` is unencrypted. For loopback-only deployments this doesn't matter, but the mismatch is confusing. Operators following DEPLOY.md will override the code default to plaintext. If they later move NATS to a remote host without updating the URL, all NATS traffic will be unencrypted.

The DEPLOY.md step 4 (Configure NATS) also doesn't show TLS configuration for NATS, yet the code assumes `/etc/nats/certs/ca.pem` will exist.

**Fix:** Either use `tls://` in the examples (with NATS TLS setup instructions) or explicitly document that `nats://` is intentional for loopback.

---

### N6 — Race condition in `sendMessage()` during file preparation

**Severity: LOW**

In `src/lib/stores/chat.ts`:

```ts
async sendMessage(agentId, text, token, pendingFiles) {
  if ((!trimmed && pendingFiles.length === 0) || activeController) {
    return
  }

  const payload = await prepareMessagePayload(text, pendingFiles)  // ← async gap

  const controller = new AbortController()
  activeController = controller   // ← set only after await
```

Between the `activeController` guard check and the `activeController = controller` assignment, `prepareMessagePayload` suspends for file I/O (reading image data, compressing, etc.). A second call to `sendMessage()` during this window will pass the `activeController` guard (still null), and both calls will proceed. The second one will overwrite `activeController`, causing the first stream's abort signal to be orphaned.

In practice this requires the user to click send twice quickly while files are being compressed, so severity is low. But it can lead to two simultaneous streams and a corrupted message list.

**Fix:** Set a boolean lock (`let sending = false`) before the `await`, and check/set it atomically, or set `activeController` to a sentinel value before the await.

---

### N7 — `DOMPurify` config uses `ALLOW_DATA_ATTR: true` unnecessarily

**Severity: LOW**

In `src/lib/markdown.ts`:

```ts
return DOMPurify.sanitize(rendered, {
  ALLOW_DATA_ATTR: true,
});
```

`ALLOW_DATA_ATTR: true` permits all `data-*` attributes to pass through. DOMPurify strips them by default because some frameworks (Alpine.js, Stimulus, Angular, etc.) treat `data-*` as executable directives. AskClaw doesn't use any such framework, so in the current codebase this is safe. However it broadens the attack surface if a library is ever added, and it's unnecessary overhead — the rendered chat bubbles have no need for `data-*` attributes.

**Fix:** Remove `ALLOW_DATA_ATTR: true` or replace with an explicit allowlist of any needed attributes.

---

### N8 — `handleHistory()` has redundant double-cors call

**Severity: LOW (code quality)**

```js
for await (const msg of sub) {
  const data = JSON.parse(sc.decode(msg.data));
  cors(res);              // ← sets headers
  return json(res, 200, data);  // json() also calls cors(res) internally
}
```

`json()` already calls `cors(res)`. The explicit `cors(res)` call before `json()` is redundant. Since `setHeader` is idempotent before `writeHead`, this causes no bug, but it's inconsistent with all other handlers and indicates copy-paste drift.

**Fix:** Remove the standalone `cors(res)` call inside the `handleHistory` for-await loop.

---

### N9 — C2 fallback makes `/health` a denial-of-service surface

**Severity: LOW**

The C2 fix (`authRequired = false` on health failure) means that if an attacker can cause `/bridge/health` to time out or return an error (e.g. by flooding the bridge with connections to exhaust workers), the frontend will enter a state where it believes no auth is needed. It will then call `/bridge/agents` without a token; if the bridge has `AUTH_TOKEN` set, this returns 401 and agents are not loaded — effectively a partial DoS where the UI appears to load but no agents are available.

This is an inherent tension of the "fail open" security tradeoff and is largely mitigated by the fact that the bridge only listens on 127.0.0.1 (not exposed directly). Noted as informational.

---

## Summary Table

| Check | Finding | Severity |
|---|---|---|
| C1 — TLS identity verification removed | ✅ PASS | — |
| C2 — authRequired fallback | ✅ PASS (tradeoff noted) | — |
| C3 — CORS restricted | ✅ PASS | — |
| C4 — /bridge/agents auth-gated | ✅ PASS | — |
| C5 — Token not logged | ✅ PASS | — |
| C6 — AUTH_TOKEN empty warning | ✅ PASS | — |
| C7 — SSE data sanitized | ✅ PASS | — |
| N1 — agents.json not in .gitignore | ❌ NEW ISSUE | HIGH |
| N2 — handleNew() no timeout | ❌ NEW ISSUE | HIGH |
| N3 — handleNew() JSON.parse uncaught | ⚠️ NEW ISSUE | MEDIUM |
| N4 — DEPLOY.md missing token env vars | ⚠️ NEW ISSUE | MEDIUM |
| N5 — DEPLOY.md nats:// vs tls:// mismatch | ⚠️ NEW ISSUE | MEDIUM |
| N6 — sendMessage() race during file prep | ⚠️ NEW ISSUE | LOW |
| N7 — DOMPurify ALLOW_DATA_ATTR | ⚠️ NEW ISSUE | LOW |
| N8 — double cors() in handleHistory | 🔵 CODE QUALITY | LOW |
| N9 — /health DoS → authRequired bypass | ℹ️ NOTED | LOW |

---

## Overall Verdict

**APPROVE WITH CONDITIONS**

All seven C1–C7 fixes are correctly implemented. No regressions introduced.

Two new issues require fixes before production exposure:

1. **N1** (`agents.json` not in `.gitignore`) is the most actionable and carries real secret-leak risk for operators following DEPLOY.md.
2. **N2** (`handleNew` missing timeout) can cause connection exhaustion under adversarial or fault conditions.

The three MEDIUM issues (N3–N5) are documentation and robustness gaps that will bite real operators. They should be addressed in the same release cycle.

Low-severity findings (N6–N9) can be addressed in a follow-up without blocking deployment.
