<script lang="ts">
  import type { DisplayMessage } from '../lib/types';
  import { renderMarkdown } from '../lib/markdown';
  import TypingIndicator from './TypingIndicator.svelte';

  let { message }: { message: DisplayMessage } = $props();
</script>

{#if message.role === 'user'}
  <div class="msg msg-user">{message.content}</div>
{:else if message.role === 'error'}
  <div class="msg msg-error">{message.content}</div>
{:else if message.content === ''}
  <div class="msg msg-assistant">
    <TypingIndicator />
  </div>
{:else}
  <div class="msg msg-assistant">
    {@html renderMarkdown(message.content)}
  </div>
{/if}

<style>
  .msg {
    max-width: 85%;
    line-height: 1.55;
    font-size: 15px;
    word-wrap: break-word;
  }
  .msg-user {
    align-self: flex-end;
    background: var(--user-bg);
    color: var(--user-text);
    padding: 10px 14px;
    border-radius: 16px 16px 4px 16px;
    white-space: pre-wrap;
  }
  .msg-assistant {
    align-self: flex-start;
    background: var(--assistant-bg);
    color: var(--assistant-text);
    padding: 10px 14px;
    border-radius: 16px 16px 16px 4px;
  }
  .msg-error {
    align-self: center;
    background: none;
    color: #e53e3e;
    font-size: 13px;
    text-align: center;
    padding: 8px;
  }
</style>
