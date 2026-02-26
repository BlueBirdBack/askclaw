# AskClaw — Svelte 5 Chat UI

## What is this?

A ChatGPT-style web UI for the OpenClaw API (Claude-based). Replaces the vanilla HTML version at `/var/www/askclaw/`.

## Tech stack

- **Svelte 5** (runes mode — `$state`, `$props`, `$effect`, `$derived`)
- **Vite** (plain SPA, no SvelteKit)
- **TypeScript**
- **marked** for markdown rendering (GFM, breaks: true)
- **npm** as package manager

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
    api.ts                    # fetchUsername(), streamChat() SSE
  components/
    Header.svelte             # Title, lang toggle, new-chat button
    Welcome.svelte            # Centered welcome screen
    MessageList.svelte        # Scrollable container with auto-scroll
    MessageBubble.svelte      # Single message bubble (user/assistant/error)
    TypingIndicator.svelte    # Three-dot bounce animation
    ChatInput.svelte          # Model select, auto-grow textarea, send button
    WarningBanner.svelte      # Floating badge (bottom-right) + popover warning
    TosModal.svelte           # Full-screen Terms of Service modal
```

## Key patterns

- **State**: Single `ChatState` class in `state.svelte.ts` with `$state` fields. Exported as singleton `chatState`. Components import and read/write fields directly.
- **CSS**: Theme variables + markdown typography in global `app.css` (needed for `{@html}` content). Component layout in scoped `<style>` blocks.
- **Streaming**: SSE logic in `api.ts` with callbacks. Mutating `$state` object properties triggers reactivity.
- **i18n**: `t(lang, key)` function with static dictionaries. Language stored in localStorage.

## Commands

```bash
npm run dev        # Start dev server (port 5173)
npm run build      # Build to dist/
npm run preview    # Preview production build
```

## Deploy

```bash
npm run build
cp -r dist/* /var/www/askclaw/
```

Production is served at https://askclaw.top/ behind nginx. The backend proxies `/v1/chat/completions` and `/whoami` to the OpenClaw API.

## Conventions

- Svelte 5 runes only — no legacy `$:`, `export let`, stores, or `createEventDispatcher`
- Props via `$props()`, events via callback props (e.g., `onsend`)
- No SvelteKit — this is a pure SPA
- Keep components small and focused
