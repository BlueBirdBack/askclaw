<script lang="ts">
  import { untrack } from 'svelte';
  import type { DisplayMessage } from '../lib/types';
  import { renderMarkdown } from '../lib/markdown';
  import { chatState } from '../lib/state.svelte';
  import { t } from '../lib/i18n';
  import TypingIndicator from './TypingIndicator.svelte';

  const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

  let { message }: { message: DisplayMessage } = $props();

  let copied = $state(false);
  let renderedHtml = $state('');

  // Throttled markdown rendering: immediate for non-streaming, ~100ms throttle during stream
  $effect(() => {
    const content = message.content;
    const isStreaming = chatState.streaming;
    const isThisStreaming = isStreaming && message.role === 'assistant'
      && untrack(() => chatState.messages.length > 0
        && chatState.messages[chatState.messages.length - 1] === message);

    if (!isThisStreaming) {
      // Not streaming — render immediately (final or historical message)
      renderedHtml = renderMarkdown(content);
      return;
    }

    // During streaming — throttle renders
    const timer = setTimeout(() => {
      renderedHtml = renderMarkdown(content);
    }, 100);

    return () => clearTimeout(timer);
  });

  function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  }

  const imageAttachments = $derived(
    (message.attachments ?? []).filter(a => IMAGE_TYPES.has(a.content_type))
  );
  const fileAttachments = $derived(
    (message.attachments ?? []).filter(a => !IMAGE_TYPES.has(a.content_type))
  );

  function copyMessage() {
    navigator.clipboard.writeText(message.content);
    copied = true;
    setTimeout(() => { copied = false; }, 1500);
  }

  const showCopyButton = $derived(
    message.role !== 'error' && !(message.role === 'assistant' && message.content === '')
  );
</script>

{#if message.role === 'user'}
  <div class="msg-wrap msg-wrap-user">
    <div class="msg msg-user">
      {#if imageAttachments.length > 0}
        <div class="msg-images">
          {#each imageAttachments as att}
            <a href={att.url} target="_blank" rel="noopener noreferrer">
              <img src={att.url} alt={att.filename} class="msg-image" />
            </a>
          {/each}
        </div>
      {/if}
      {#if fileAttachments.length > 0}
        <div class="msg-files">
          {#each fileAttachments as att}
            <a class="file-link" href={att.url} target="_blank" rel="noopener noreferrer" download={att.filename}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              <span class="file-link-name">{att.filename}</span>
              <span class="file-link-size">({formatSize(att.size)})</span>
            </a>
          {/each}
        </div>
      {/if}
      {#if message.content}
        <span class="msg-text">{message.content}</span>
      {/if}
    </div>
    {#if showCopyButton}
      <button class="copy-btn" onclick={copyMessage} title={t(chatState.lang, 'copied')}>
        {#if copied}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        {:else}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        {/if}
      </button>
    {/if}
  </div>
{:else if message.role === 'error'}
  <div class="msg msg-error">{message.content}</div>
{:else if message.content === ''}
  <div class="msg msg-assistant">
    <TypingIndicator />
  </div>
{:else}
  <div class="msg-wrap msg-wrap-assistant">
    <div class="msg msg-assistant">
      {@html renderedHtml}
    </div>
    {#if showCopyButton}
      <button class="copy-btn" onclick={copyMessage} title={t(chatState.lang, 'copied')}>
        {#if copied}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        {:else}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        {/if}
      </button>
    {/if}
  </div>
{/if}

<style>
  .msg-wrap {
    position: relative;
    display: flex;
    gap: 4px;
    max-width: 85%;
  }
  .msg-wrap-user {
    align-self: flex-end;
    flex-direction: row-reverse;
  }
  .msg-wrap-assistant {
    align-self: flex-start;
  }
  .msg {
    line-height: 1.55;
    font-size: 15px;
    word-wrap: break-word;
    min-width: 0;
  }
  .msg-user {
    background: var(--user-bg);
    color: var(--user-text);
    padding: 10px 14px;
    border-radius: 16px 16px 4px 16px;
    white-space: pre-wrap;
  }
  .msg-images {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 6px;
  }
  .msg-images:last-child,
  .msg-files:last-child {
    margin-bottom: 0;
  }
  .msg-files {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 6px;
  }
  .file-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.08);
    color: inherit;
    text-decoration: none;
    font-size: 13px;
    max-width: 100%;
  }
  .file-link:hover {
    background: rgba(0, 0, 0, 0.14);
  }
  .file-link-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }
  .file-link-size {
    flex-shrink: 0;
    opacity: 0.7;
    font-size: 12px;
  }
  .file-link svg {
    flex-shrink: 0;
  }
  .msg-image {
    max-width: 200px;
    max-height: 200px;
    border-radius: 8px;
    object-fit: cover;
    cursor: pointer;
  }
  .msg-text {
    display: block;
  }
  .msg-assistant {
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
    max-width: 85%;
  }
  .copy-btn {
    flex-shrink: 0;
    align-self: flex-start;
    margin-top: 6px;
    background: none;
    border: none;
    color: var(--text3);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .copy-btn:hover {
    color: var(--text2);
    background: var(--bg2);
  }
  .msg-wrap:hover .copy-btn {
    opacity: 1;
  }
  @media (hover: none) {
    .copy-btn {
      opacity: 1;
    }
  }
</style>
