<script lang="ts">
  import { chatState } from '../lib/state.svelte';
  import { t } from '../lib/i18n';

  let { onopentos }: { onopentos: () => void } = $props();
</script>

{#if !chatState.warningDismissed}
  <div class="banner">
    <span>{t(chatState.lang, 'warning')}</span>
    <button type="button" class="tos-link" onclick={onopentos}>
      {t(chatState.lang, 'tosLink')}
    </button>
    <button type="button" class="close-btn" onclick={() => chatState.dismissWarning()} aria-label="Close">&times;</button>
  </div>
{/if}

<style>
  .banner {
    background: var(--warning-bg);
    color: var(--warning-text);
    text-align: center;
    padding: 8px 16px;
    font-size: 13px;
    line-height: 1.5;
    flex-shrink: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--warning-text) 20%, transparent);
    position: relative;
  }

  .tos-link {
    background: none;
    border: none;
    color: var(--warning-text);
    text-decoration: underline;
    font-size: 13px;
    cursor: pointer;
    padding: 0;
    margin-left: 12px;
    font-family: inherit;
  }

  .tos-link:hover {
    opacity: 0.8;
  }

  .close-btn {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--warning-text);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    padding: 2px 6px;
    opacity: 0.6;
  }

  .close-btn:hover {
    opacity: 1;
  }
</style>
