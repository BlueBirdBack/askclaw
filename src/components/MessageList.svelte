<script lang="ts">
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
    scrollToBottom();
  });

  function scrollToBottom() {
    if (container) {
      // Use tick-like delay so DOM updates first
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
    {#each chatState.messages as message}
      <MessageBubble {message} />
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
