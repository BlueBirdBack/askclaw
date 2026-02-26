<script lang="ts">
  import { chatState } from '../lib/state.svelte';
  import { t } from '../lib/i18n';

  let { open, onclose }: { open: boolean; onclose: () => void } = $props();
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onkeydown={(e) => e.key === 'Escape' && onclose()} onclick={onclose}>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title">{t(chatState.lang, 'tosTitle')}</h2>
        <button type="button" class="modal-x" onclick={onclose}>&times;</button>
      </div>
      <div class="modal-body">{t(chatState.lang, 'tosBody')}</div>
      <button type="button" class="modal-close" onclick={onclose}>
        {t(chatState.lang, 'tosClose')}
      </button>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
  }

  .modal {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    max-width: 520px;
    width: 100%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px 0;
  }

  .modal-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
  }

  .modal-x {
    background: none;
    border: none;
    font-size: 22px;
    color: var(--text3);
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  }

  .modal-x:hover {
    color: var(--text);
  }

  .modal-body {
    padding: 16px 24px;
    font-size: 14px;
    line-height: 1.7;
    color: var(--text2);
    overflow-y: auto;
    white-space: pre-line;
    flex: 1;
    min-height: 0;
  }

  .modal-close {
    margin: 0 24px 20px;
    padding: 10px 24px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-family: inherit;
    cursor: pointer;
    flex-shrink: 0;
  }

  .modal-close:hover {
    background: var(--accent2);
  }
</style>
