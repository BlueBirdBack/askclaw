# Telegram-Related Files in /github/openclaw

## Core Bot Implementation — `src/telegram/`

| File | Purpose |
|------|---------|
| `bot.ts` | Main bot factory using grammY; handles sequentialization, deduplication, update tracking |
| `bot-handlers.ts` | Registers handlers for messages, callbacks, reactions, edits |
| `bot-message.ts` | Message processing pipeline for chat routing and responses |
| `bot-message-context.ts` | DM threads, audio transcripts, context building |
| `bot-message-dispatch.ts` | Message routing |
| `bot-native-commands.ts` | Registers `/pair`, `/activation`, `/config` commands via BotFather |
| `bot-native-command-menu.ts` | Command menu configuration |
| `bot-updates.ts` | Update deduplication |
| `bot-access.ts` | Access control |
| `webhook.ts` | Webhook HTTP server (default port 8787); handles `POST /telegram-webhook` |
| `token.ts` | Resolves tokens from config, `tokenFile`, or `TELEGRAM_BOT_TOKEN` env var |
| `accounts.ts` | Multi-account management and action gating |
| `send.ts` | Outbound messages: `sendMessageTelegram()`, `editMessageTelegram()`, `deleteMessageTelegram()`, `reactMessageTelegram()`, `sendStickerTelegram()`, `createForumTopicTelegram()` |
| `fetch.ts` | Custom fetch with proxy support and DNS result order control |
| `format.ts` | Markdown-to-Telegram HTML conversion (GFM, HTML escaping) |
| `inline-buttons.ts` | Inline keyboard support; scope control (`off \| dm \| group \| all \| allowlist`) |
| `button-types.ts` | Button type definitions |
| `sticker-cache.ts` | Vision-based sticker description cache (`~/.openclaw/telegram/sticker-cache.json`) |
| `draft-stream.ts` | Live streaming / partial message preview |
| `draft-chunking.ts` | Block streaming with coalescing and text chunking strategies |
| `group-access.ts` | Group policy enforcement (`open \| allowlist \| disabled`) |
| `dm-access.ts` | DM policy enforcement (`pairing \| allowlist \| open \| disabled`); pairing code generation |
| `group-migration.ts` | Handles `migrate_to_chat_id` updates for supergroup conversion |
| `targets.ts` | Normalizes Telegram user/group IDs; username-to-ID resolution |
| `monitor.ts` | Connection health checks |
| `update-offset-store.ts` | Persists last processed update ID to prevent duplicate processing |
| `sendchataction-401-backoff.ts` | Circuit breaker for `sendChatAction` 401 errors |
| `reaction-level.ts` | Reaction capability levels (`off \| ack \| minimal \| extensive`) |
| `proxy.ts` | SOCKS/HTTP proxy routing for Bot API |
| `audit.ts` | Message tracking and debugging |
| `voice.ts` | Voice message handling |
| `caption.ts` | Media caption handling |
| `network-config.ts` | Network settings |
| `network-errors.ts` | Network error handling |
| `allowed-updates.ts` | Telegram update type filtering |
| `api-logging.ts` | API call logging |

## Configuration & Types — `src/config/`

| File | Purpose |
|------|---------|
| `types.telegram.ts` | TypeScript types: `TelegramAccountConfig`, `TelegramGroupConfig`, `TelegramTopicConfig`, `TelegramNetworkConfig`, `TelegramActionConfig`, `TelegramConfig` |
| `telegram-custom-commands.ts` | Custom command validation (`TELEGRAM_COMMAND_NAME_PATTERN`, duplicate/reserved checks) |

## Channel Plugins — `src/channels/plugins/`

| File | Purpose |
|------|---------|
| `outbound/telegram.ts` | Outbound message delivery (`deliveryMode: "direct"`, HTML formatting, media attachments) |
| `normalize/telegram.ts` | Telegram message → channel envelope conversion; media placeholder handling |
| `actions/telegram.ts` | Agent tool actions: `send`, `react`, `delete`, `edit`, `sticker`, `sticker-search` |
| `onboarding/telegram.ts` | Setup wizard for token configuration and user ID discovery |
| `status-issues/telegram.ts` | Telegram-specific config validation and diagnostics |

## Extension Plugin — `extensions/telegram/`

| File | Purpose |
|------|---------|
| `index.ts` | Plugin entry point; registers channel plugin and sets runtime |
| `src/channel.ts` | Channel plugin definition, onboarding adapter, pairing callbacks, message action adapter, probe |
| `src/runtime.ts` | Exposes Telegram channel methods to the plugin system |
| `openclaw.plugin.json` | Plugin manifest (channel ID: `telegram`) |
| `package.json` | Package metadata (version 2026.2.26) |

## Agent Tools — `src/agents/tools/`

| File | Purpose |
|------|---------|
| `telegram-actions.ts` | Telegram-specific agent tools: button style validation, message actions, sticker search, reaction gating |

## Documentation — `docs/`

| File | Purpose |
|------|---------|
| `channels/telegram.md` | Comprehensive user guide: BotFather setup, DM/group policies, webhook vs long polling, custom commands, forum topics, inline buttons, media handling, reactions, full config reference |
| `zh-CN/channels/telegram.md` | Chinese translation of the above |

## Dependencies (from `package.json`)

| Package | Version | Purpose |
|---------|---------|---------|
| `grammy` | ^1.40.1 | Main Telegram Bot API framework |
| `@grammyjs/runner` | ^2.0.3 | Update runner with concurrency control |
| `@grammyjs/transformer-throttler` | ^1.2.1 | API rate limiting |
| `@grammyjs/types` | ^3.24.0 (dev) | Type definitions |

## Test Files (45+)

Tests are spread across the codebase and cover:

- Bot creation and initialization
- Message contexts and routing
- Native and custom commands
- DM and group access control
- Inline buttons and reactions
- Media handling (stickers, voice, video)
- Network, proxy, and webhook modes
- Update deduplication and offset management
- Channel plugin integration

Notable test files:

| File | Purpose |
|------|---------|
| `src/config/telegram-webhook-port.test.ts` | Webhook port configuration tests |
| `src/config/telegram-webhook-secret.test.ts` | Webhook secret validation tests |
| `src/config/config.telegram-custom-commands.test.ts` | Custom command validation tests |

## Configuration Structure

Telegram config supports:

- **Token resolution**: `botToken`, `tokenFile`, env `TELEGRAM_BOT_TOKEN`
- **Access control**: DM/group policies with allowlists
- **Multi-account**: Independent bots per account
- **Group features**: Forum topics, threading, mention gating
- **Streaming**: Live message editing (preview/block modes)
- **Commands**: Native + custom command menus
- **Actions**: Message send/edit/delete, reactions, stickers
- **Media**: Audio, video, sticker handling with caching
- **Networking**: Proxy support, DNS control, custom timeouts
- **Webhook**: Optional webhook mode vs long polling

---

## Workflow: Sending an Image to the Telegram Bot

End-to-end flow of sending a photo to the OpenClaw Telegram bot and receiving a vision-based reply.

### Phase 1: Telegram Receives Your Image

You send a photo in the Telegram chat. grammY (the bot framework) delivers the update to the bot.

**`src/telegram/bot-handlers.ts`** picks it up. It calls `hasInboundMedia()` which checks `msg.photo`, `msg.video`, `msg.document`, etc. For a photo, it takes the **highest-resolution** entry from the `msg.photo` array.

If you sent multiple images as an album, they're buffered together as a `MediaGroupEntry` so they're processed as one unit.

### Phase 2: Download the Image from Telegram Servers

Telegram doesn't send image bytes directly — it sends a `file_id`. The bot must fetch the actual file.

1. Calls `ctx.getFile()` → gets a `file_path` from Telegram's API
2. Constructs the download URL: `https://api.telegram.org/file/bot{TOKEN}/{file_path}`
3. `fetchRemoteMedia()` downloads the image buffer via HTTP, validates size limits
4. `saveMediaBuffer()` writes it to local disk

**Result**: a `TelegramMediaRef` like:
```
{ path: "/tmp/.../inbound/image.jpg", contentType: "image/jpeg" }
```

### Phase 3: Build the Message Context

**`src/telegram/bot-message-context.ts`** — `buildTelegramMessageContext()` assembles the full context:

- `MediaPath` / `MediaPaths` — local file paths to the downloaded images
- `MediaType` / `MediaTypes` — MIME types
- `Body` — the user's text, or `<media:image>` if no caption was provided

A media note is appended to the message body for the agent:
```
[media attached: /tmp/.../image.jpg (image/jpeg)]
```

### Phase 4: Detect Vision Capability & Load Images

**`agents/pi-embedded-runner/run/images.ts`** — `detectAndLoadPromptImages()`:

1. **Checks if the model supports vision** (`model.input?.includes("image")`)
2. **Parses** the `[media attached: ...]` markers in the prompt using regex
3. **Loads each image** from disk via `loadWebMedia()` → gets a `Buffer`
4. **Converts to base64**: `buffer.toString("base64")`
5. **Sanitizes**: validates dimensions, optionally re-encodes to JPEG to reduce size

**Result**: an array of image blocks:
```ts
[{ type: "image", data: "base64string...", mimeType: "image/jpeg" }]
```

If the model does **not** support vision, a fallback path runs: the image is described by a separate vision model, and that text description is injected into the prompt instead.

### Phase 5: Call the LLM with Multimodal Content

The `pi-ai` library constructs the API request. The message sent to the LLM looks like:

```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "What's in this image?" },
    { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,/9j/4AAQ..." } }
  ]
}
```

This is a standard multimodal chat completion call — the LLM (Claude) sees both the text and the image and generates a response.

### Phase 6: Stream the Response Back to Telegram

The LLM streams tokens back. The bot delivers them to you:

1. **`src/telegram/draft-stream.ts`** — buffers partial output and periodically **edits** the Telegram message in-place (live typing effect)
2. **`src/telegram/format.ts`** — converts the LLM's markdown output to **Telegram HTML** parse mode
3. **`src/telegram/send.ts`** — `sendMessageTelegram()` delivers the final message; long responses are split into multiple Telegram messages (4096 char limit)

### Visual Summary

```
You (Telegram)
  │  send photo
  ▼
grammY bot receives update
  │  msg.photo[last] → file_id
  ▼
ctx.getFile() → Telegram API
  │  returns file_path
  ▼
fetchRemoteMedia() → HTTPS download
  │  image buffer
  ▼
saveMediaBuffer() → /tmp/.../image.jpg
  │
  ▼
buildTelegramMessageContext()
  │  body: "[media attached: /tmp/.../image.jpg (image/jpeg)]"
  ▼
detectAndLoadPromptImages()
  │  reads file → base64
  ▼
LLM API call (multimodal)
  │  { type: "text", ... } + { type: "image_url", data: base64 }
  ▼
LLM streams response
  │
  ▼
draft-stream → format → sendMessageTelegram()
  │
  ▼
You see the reply in Telegram
```

The key insight: Telegram gives you a `file_id`, not bytes. The bot downloads the image to disk, then reads it back as base64 to embed directly in the LLM API call as a `data:` URI. The LLM natively "sees" the image through its vision capability.

---

## Why AskClaw Images Were Not Working

### The Problem

AskClaw sent images to `/v1/chat/completions` (OpenAI-compatible endpoint), but that endpoint **silently strips all image content blocks**.

In `src/gateway/openai-http.ts`, the `extractTextContent()` function only accepts `type: "text"` and `type: "input_text"` blocks. Any `image_url` blocks are mapped to `""` and discarded. **No error is thrown** — the LLM just never sees the image.

```typescript
// extractTextContent() — images silently dropped
if (type === "text" && typeof text === "string") return text;  // kept
if (type === "input_text" && typeof text === "string") return text;  // kept
return "";  // ← image_url blocks land here
```

### The Telegram Bot Bypasses This Entirely

The Telegram bot never calls `/v1/chat/completions`. It goes through the internal pipeline:

```
ImageContent { type: "image", data: base64, mimeType }
       ↓
activeSession.prompt(text, { images: [...] })
       ↓
pi-ai library auto-converts per provider:
  ├─ Claude  → { type: "image", source: { type: "base64", media_type, data } }
  ├─ OpenAI  → { type: "image_url", image_url: { url: "data:..." } }
  └─ Gemini  → provider-specific format
```

### The Fix: Use `/v1/responses` Instead

OpenClaw also exposes a `/v1/responses` endpoint (OpenAI Responses API format) which **does** support images natively via `input_image` content blocks:

```json
{
  "model": "openclaw:main",
  "stream": true,
  "instructions": "System prompt here",
  "input": [
    {
      "type": "message",
      "role": "user",
      "content": [
        { "type": "input_text", "text": "What is in this image?" },
        {
          "type": "input_image",
          "source": {
            "type": "base64",
            "media_type": "image/jpeg",
            "data": "<base64-encoded-bytes>"
          }
        }
      ]
    }
  ]
}
```

**Streaming events** differ from `/v1/chat/completions`:

| `/v1/chat/completions` | `/v1/responses` |
|------------------------|-----------------|
| `data: {"choices":[{"delta":{"content":"text"}}]}` | `event: response.output_text.delta`<br>`data: {"delta":"text"}` |
| `data: [DONE]` | `event: response.completed` + `data: [DONE]` |

AskClaw was updated to use `/v1/responses` for all LLM calls, which enables image support without modifying the OpenClaw backend.
