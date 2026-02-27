<script lang="ts">
  import { chatState } from '../lib/state.svelte';
  import { t } from '../lib/i18n';
  import ExportMenu from './ExportMenu.svelte';
  import SettingsMenu from './SettingsMenu.svelte';

  let { onopenpassword, onopentos }: { onopenpassword: () => void; onopentos: () => void } = $props();
</script>

<header>
  <div class="left">
    <button class="hamburger" aria-label="Toggle sidebar" onclick={() => chatState.toggleSidebar()}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 12h18M3 6h18M3 18h18" />
      </svg>
    </button>
    <h1>{t(chatState.lang, 'title')}</h1>
  </div>
  <div class="actions">
    {#if chatState.hasMessages}
      <ExportMenu messages={chatState.messages} />
    {/if}
    <SettingsMenu {onopenpassword} {onopentos} />
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
  .left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  h1 {
    font-size: 18px;
    font-weight: 600;
  }
  .actions {
    display: flex;
    gap: 6px;
  }
  .hamburger {
    background: none;
    border: none;
    color: var(--text2);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: flex;
    align-items: center;
  }
  .hamburger:hover {
    background: var(--bg2);
  }
  /* Hide hamburger on desktop — sidebar is always visible */
  @media (min-width: 768px) {
    .hamburger {
      display: none;
    }
  }
</style>
