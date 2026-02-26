<script lang="ts">
  import { chatState } from '../lib/state.svelte';
  import { t } from '../lib/i18n';
  import { exportChatAsMarkdown } from '../lib/export';
</script>

<header>
  <h1>{t(chatState.lang, 'title')}</h1>
  <div class="actions">
    {#if chatState.hasMessages}
      <button onclick={() => exportChatAsMarkdown(chatState.messages)}>
        {t(chatState.lang, 'exportChat')}
      </button>
    {/if}
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
