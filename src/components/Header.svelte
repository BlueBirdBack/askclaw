<script lang="ts">
  import { chatState } from '../lib/state.svelte';
  import { t } from '../lib/i18n';
  import { exportChatAsMarkdown } from '../lib/export';

  let { onopenpassword }: { onopenpassword: () => void } = $props();
</script>

<header>
  <h1>{t(chatState.lang, 'title')}</h1>
  <div class="actions">
    {#if chatState.hasMessages}
      <button onclick={() => exportChatAsMarkdown(chatState.messages)}>
        {t(chatState.lang, 'exportChat')}
      </button>
    {/if}
    <button onclick={onopenpassword} title={t(chatState.lang, 'changePassword')}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    </button>
    <button onclick={() => chatState.toggleLang()}>
      {t(chatState.lang, 'langSwitch')}
    </button>
    <button onclick={() => chatState.newChat()}>
      {t(chatState.lang, 'newChat')}
    </button>
  </div>
</header>

<style>
  header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }
  h1 {
    font-size: 18px;
    font-weight: 600;
  }
  .actions {
    display: flex;
    gap: 6px;
  }
  button {
    background: none;
    border: 1px solid var(--border);
    color: var(--text2);
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
  }
  button:hover {
    background: var(--bg2);
  }
</style>
