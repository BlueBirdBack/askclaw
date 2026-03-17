<script lang="ts">
  import { renderMarkdown } from '../markdown'
  import type { ChatMessage } from '../stores/chat'

  interface Props {
    agentLabel?: string
    highlighted?: boolean
    message: ChatMessage
    onForward?: (content: string) => void
    pending?: boolean
  }

  let {
    agentLabel = '',
    highlighted = false,
    message,
    onForward = undefined,
    pending = false,
  }: Props = $props()

  const timeFormatter = new Intl.DateTimeFormat([], {
    hour: 'numeric',
    minute: '2-digit',
  })

  let isUser = $derived(message.role === 'user')
  let timestampLabel = $derived(timeFormatter.format(message.ts))
  let copiedMessage = $state(false)
  let messageCopyTimeout = 0
  let canForward = $derived(!isUser && Boolean(onForward) && Boolean(message.content.trim()))

  async function handleCodeCopy(event: Event) {
    const target = event.target

    if (!(target instanceof HTMLButtonElement) || !target.classList.contains('code-copy-btn')) {
      return
    }

    const block = target.closest('pre')
    const code = block?.querySelector('code')

    if (!code?.textContent) {
      return
    }

    await navigator.clipboard.writeText(code.textContent)

    const originalLabel = target.textContent
    target.textContent = 'Copied'
    window.setTimeout(() => {
      target.textContent = originalLabel ?? 'Copy'
    }, 1400)
  }

  async function handleMessageCopy() {
    if (!message.content.trim()) {
      return
    }

    await navigator.clipboard.writeText(message.content)
    copiedMessage = true
    window.clearTimeout(messageCopyTimeout)
    messageCopyTimeout = window.setTimeout(() => {
      copiedMessage = false
    }, 1400)
  }

  function handleForwardClick() {
    if (!canForward || !onForward) {
      return
    }

    onForward(message.content)
  }

  function wireCopyButtons(node: HTMLElement) {
    const listener = (event: Event) => {
      void handleCodeCopy(event)
    }

    node.addEventListener('click', listener)

    return {
      destroy() {
        node.removeEventListener('click', listener)
      },
    }
  }
</script>

<article class:highlighted class={`msg-row ${isUser ? 'user' : 'assistant'}`}>
  <div class="bubble-wrap">
    <div class="msg-meta">
      <span>{isUser ? 'You' : agentLabel}</span>
      <span>{timestampLabel}</span>
    </div>

    {#if pending && !message.content}
      <div class="typing-dots" aria-label="Assistant is typing">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    {:else}
      <div class="bubble" use:wireCopyButtons>
        {#if isUser}
          {message.content}
        {:else}
          {@html renderMarkdown(message.content)}
        {/if}
      </div>
    {/if}
  </div>

  {#if message.content}
    <div class="msg-actions">
      <button
        class="msg-action-btn"
        type="button"
        aria-label={copiedMessage ? 'Copied message' : 'Copy message'}
        title={copiedMessage ? 'Copied' : 'Copy'}
        onclick={() => void handleMessageCopy()}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect
            x="9"
            y="9"
            width="13"
            height="13"
            rx="2"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          />
          <path
            d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          />
        </svg>
      </button>

      {#if canForward}
        <button
          class="msg-action-btn"
          type="button"
          aria-label="Forward message"
          title="Forward"
          onclick={handleForwardClick}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M14 5l7 7-7 7"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
            <path
              d="M21 12H10a7 7 0 0 0-7 7"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
        </button>
      {/if}
    </div>
  {/if}
</article>

<style>
  .msg-row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
    animation: slide-up 0.15s ease-out;
  }

  .msg-row.user {
    justify-content: flex-end;
  }

  .msg-row.highlighted .bubble-wrap {
    border-radius: 1rem;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent);
    background: color-mix(in srgb, var(--accent) 8%, white);
    padding: 0.35rem 0.45rem;
  }

  .bubble-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.18rem;
    min-width: 0;
    max-width: min(100%, 42rem);
    position: relative;
    transition: box-shadow 0.18s, background 0.18s;
  }

  .msg-row.user .bubble-wrap {
    align-items: flex-end;
  }

  .msg-meta {
    display: flex;
    gap: 0.4rem;
    font-size: 0.67rem;
    color: var(--text-dim);
    padding: 0 0.15rem;
  }

  .bubble {
    padding: 0.55rem 0.2rem;
    border-radius: 0;
    background: transparent;
    color: var(--text);
    line-height: 1.65;
    overflow-wrap: anywhere;
    font-size: 0.925rem;
  }

  .msg-row.user .bubble {
    background: var(--user-bg);
    color: #ffffff;
    padding: 0.6rem 0.9rem;
    border-radius: 1.1rem 1.1rem 0.25rem 1.1rem;
    white-space: pre-wrap;
  }

  .msg-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
    align-self: flex-start;
    margin-top: 0.12rem;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .msg-action-btn {
    flex-shrink: 0;
    padding: 0.22rem;
    border: none;
    border-radius: 0.32rem;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
    transition: color 0.12s, background 0.12s;
  }

  .msg-row.user .msg-actions {
    order: 3;
  }

  .bubble-wrap:hover + .msg-actions,
  .msg-actions:hover,
  .msg-actions:focus-within {
    opacity: 1;
  }

  .msg-action-btn:hover {
    color: var(--text-muted);
    background: var(--asst-bg);
  }

  @media (hover: none) {
    .msg-actions {
      opacity: 0.35;
    }
  }

  .typing-dots {
    display: inline-flex;
    gap: 0.26rem;
    padding: 0.72rem 0.9rem;
    border-radius: 1.1rem 1.1rem 1.1rem 0.25rem;
    background: var(--asst-bg);
  }

  .typing-dot {
    width: 0.36rem;
    height: 0.36rem;
    border-radius: 50%;
    background: var(--text-dim);
    animation: bounce 1.2s infinite ease-in-out;
  }

  .typing-dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .typing-dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  :global(.bubble p),
  :global(.bubble ul),
  :global(.bubble ol),
  :global(.bubble blockquote),
  :global(.bubble h1),
  :global(.bubble h2),
  :global(.bubble h3) {
    margin: 0 0 0.65rem;
  }

  :global(.bubble > *:last-child) {
    margin-bottom: 0;
  }

  :global(.bubble h1) {
    font-size: 1.08em;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  :global(.bubble h2) {
    font-size: 1em;
    font-weight: 600;
  }

  :global(.bubble h3) {
    font-size: 0.94em;
    font-weight: 600;
  }

  :global(.bubble pre) {
    position: relative;
    overflow-x: auto;
    background: #111827;
    color: #f8fafc;
    border-radius: 0.95rem;
    padding: 1rem;
    margin: 0.9rem 0;
  }

  :global(.bubble code) {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.86em;
  }

  :global(.bubble :not(pre) > code) {
    background: color-mix(in srgb, var(--asst-bg) 82%, white);
    border-radius: 0.4rem;
    padding: 0.14rem 0.34rem;
  }

  :global(.bubble .code-copy-btn) {
    position: absolute;
    top: 0.6rem;
    right: 0.6rem;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(15, 23, 42, 0.88);
    color: #f8fafc;
    border-radius: 0.45rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.72rem;
    cursor: pointer;
  }

  :global(.bubble blockquote) {
    border-left: 3px solid var(--border-s);
    padding-left: 0.8rem;
    color: var(--text-muted);
  }

  :global(.bubble a) {
    color: var(--accent);
    text-decoration: underline;
  }

  @keyframes bounce {
    0%,
    80%,
    100% {
      transform: translateY(0);
      opacity: 0.45;
    }

    40% {
      transform: translateY(-0.18rem);
      opacity: 1;
    }
  }

  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateY(0.25rem);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
