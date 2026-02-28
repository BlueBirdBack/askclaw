<script lang="ts">
  import { untrack } from 'svelte';
  import { chatState } from '../lib/state.svelte';
  import MessageBubble from './MessageBubble.svelte';
  import TypingIndicator from './TypingIndicator.svelte';
  import Welcome from './Welcome.svelte';

  let container: HTMLDivElement;

  // Effect 1: scroll on new messages or search-result jump
  $effect(() => {
    chatState.messages.length;

    const targetIdx = untrack(() => chatState.scrollToMessageIndex);

    if (targetIdx !== null) {
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

  // Effect 2: interval-based scroll during streaming (no per-chunk dependency)
  $effect(() => {
    if (!chatState.streaming) return;

    const interval = setInterval(() => scrollToBottom(), 150);

    return () => {
      clearInterval(interval);
      // Final scroll after streaming ends
      scrollToBottom();
    };
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
  {#if chatState.loading && !chatState.hasMessages}
    <div class="loading-center"><TypingIndicator /></div>
  {:else if !chatState.hasMessages}
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
  .loading-center {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
