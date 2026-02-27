<script lang="ts">
  import { untrack } from 'svelte';
  import { chatState } from '../lib/state.svelte';
  import MessageBubble from './MessageBubble.svelte';
  import Welcome from './Welcome.svelte';

  let container: HTMLDivElement;

  $effect(() => {
    // Track messages length to trigger scroll
    chatState.messages.length;
    // Also track last message content for streaming updates
    if (chatState.messages.length > 0) {
      chatState.messages[chatState.messages.length - 1].content;
    }

    // Read without tracking to avoid re-trigger when we clear it
    const targetIdx = untrack(() => chatState.scrollToMessageIndex);

    if (targetIdx !== null) {
      // Wait for DOM to render, then scroll to the target message
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          chatState.scrollToMessageIndex = null;
          if (!container) return;
          const target = container.querySelector(`[data-msg-index="${targetIdx}"]`) as HTMLElement | null;
          if (target) {
            target.scrollIntoView({ block: 'center', behavior: 'instant' });
            target.classList.add('highlight-flash');
            setTimeout(() => target.classList.remove('highlight-flash'), 1500);
          }
        });
      });
    } else {
      scrollToBottom();
    }
  });

  function scrollToBottom() {
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }
</script>

<div class="messages" bind:this={container}>
  {#if !chatState.hasMessages}
    <Welcome />
  {:else}
    {#each chatState.messages as message, i}
      <div data-msg-index={i}>
        <MessageBubble {message} />
      </div>
    {/each}
  {/if}
</div>

<style>
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
</style>
