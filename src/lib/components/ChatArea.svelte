<script lang="ts">
  import { tick } from 'svelte'

  import EmptyState from './EmptyState.svelte'
  import Message from './Message.svelte'
  import type { ChatMessage } from '../stores/chat'

  interface Props {
    agentLabel?: string
    isStreaming?: boolean
    messages?: ChatMessage[]
    onForward?: (content: string) => void
    pendingFirstDelta?: boolean
    targetMessageId?: number | null
  }

  let {
    agentLabel = '',
    isStreaming = false,
    messages = [],
    onForward = undefined,
    pendingFirstDelta = false,
    targetMessageId = null,
  }: Props = $props()

  let scroller = $state<HTMLElement | null>(null)
  const messageNodes = new Map<string, HTMLElement>()

  let scrollKey = $derived(
    `${messages.length}:${messages.at(-1)?.content.length ?? 0}:${pendingFirstDelta}:${targetMessageId ?? ''}`,
  )

  function bindMessage(node: HTMLElement, messageId: string) {
    messageNodes.set(messageId, node)

    return {
      destroy() {
        messageNodes.delete(messageId)
      },
    }
  }

  async function syncScroll() {
    await tick()

    if (targetMessageId !== null) {
      const targetMessage = messages.find((message) => message.persistedId === targetMessageId)
      const targetNode = targetMessage ? messageNodes.get(targetMessage.id) : null

      if (targetNode) {
        targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
    }

    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight
    }
  }

  $effect(() => {
    scrollKey

    if (scroller) {
      void syncScroll()
    }
  })
</script>

<section class="chat-scroll" bind:this={scroller}>
  <div class="chat-shell">
    <EmptyState active={messages.length === 0} agentName={agentLabel} />

    <div class="messages" role="log" aria-live={isStreaming ? 'polite' : 'off'} aria-atomic="false">
      {#each messages as message, index (message.id)}
        <div use:bindMessage={message.id}>
          <Message
            {agentLabel}
            highlighted={targetMessageId !== null && message.persistedId === targetMessageId}
            {message}
            {onForward}
            pending={pendingFirstDelta && index === messages.length - 1 && message.role !== 'user'}
          />
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  .chat-scroll {
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0.75rem;
    scroll-behavior: smooth;
    min-height: 0;
  }

  .chat-scroll::-webkit-scrollbar {
    width: 0.35rem;
  }

  .chat-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .chat-scroll::-webkit-scrollbar-thumb {
    background: var(--border-s);
    border-radius: 0.2rem;
  }

  .chat-shell {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 0.75rem;
    width: min(100%, 50rem);
    margin: 0 auto;
    min-height: 100%;
  }

  .messages {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  @media (min-width: 840px) {
    .chat-scroll {
      padding: 1rem;
    }
  }
</style>
