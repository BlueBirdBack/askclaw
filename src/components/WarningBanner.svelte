<script lang="ts">
  import { chatState } from '../lib/state.svelte';
  import { t } from '../lib/i18n';

  let { onopentos }: { onopentos: () => void } = $props();

  let expanded = $state(false);
</script>

{#if expanded}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div class="backdrop" onclick={() => expanded = false}></div>
  <div class="popover">
    <span>{t(chatState.lang, 'warning')}</span>
    <button type="button" class="tos-link" onclick={onopentos}>
      {t(chatState.lang, 'tosLink')}
    </button>
  </div>
{/if}

<button type="button" class="badge" onclick={() => expanded = !expanded} aria-label="Warning">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
</button>

<style>
  .badge {
    position: fixed;
    bottom: 72px;
    right: 16px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--warning-bg);
    color: var(--warning-text);
    border: 1px solid color-mix(in srgb, var(--warning-text) 25%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    z-index: 100;
    transition: transform 0.15s ease;
  }

  .badge:hover {
    transform: scale(1.08);
  }

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .popover {
    position: fixed;
    bottom: 120px;
    right: 16px;
    background: var(--warning-bg);
    color: var(--warning-text);
    padding: 10px 14px;
    border-radius: 10px;
    font-size: 13px;
    line-height: 1.5;
    max-width: 260px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    border: 1px solid color-mix(in srgb, var(--warning-text) 20%, transparent);
    z-index: 101;
  }

  .tos-link {
    display: block;
    margin-top: 6px;
    background: none;
    border: none;
    color: var(--warning-text);
    text-decoration: underline;
    font-size: 13px;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
  }

  .tos-link:hover {
    opacity: 0.8;
  }
</style>
