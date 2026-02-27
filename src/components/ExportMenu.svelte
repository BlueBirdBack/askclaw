<script lang="ts">
  import type { DisplayMessage } from '../lib/types';
  import { chatState } from '../lib/state.svelte';
  import { exportChatAsMarkdown, exportChatAsPdf } from '../lib/export';

  let { messages }: { messages: DisplayMessage[] } = $props();

  let open = $state(false);
  let exporting = $state(false);

  async function handlePdf() {
    exporting = true;
    try {
      await exportChatAsPdf(messages);
    } finally {
      exporting = false;
      open = false;
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div class="backdrop" onclick={() => open = false}></div>
{/if}

<div class="export-wrap">
  <button class="export-btn" onclick={() => open = !open}>
    {chatState.lang === 'zh' ? '导出' : 'Export'}
  </button>

  {#if open}
    <div class="dropdown">
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="row clickable" onclick={() => { exportChatAsMarkdown(messages); open = false; }}>
        <span>Markdown (.md)</span>
      </div>
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="row clickable" onclick={handlePdf}>
        <span>{exporting ? (chatState.lang === 'zh' ? '导出中...' : 'Exporting...') : 'PDF (.pdf)'}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .export-wrap {
    position: relative;
  }

  .export-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text2);
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
  }
  .export-btn:hover {
    background: var(--bg2);
  }

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .dropdown {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px;
    min-width: 160px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--text);
  }

  .row.clickable {
    cursor: pointer;
  }
  .row.clickable:hover {
    background: var(--bg2);
  }
</style>
