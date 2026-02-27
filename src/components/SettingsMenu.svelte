<script lang="ts">
  import { chatState } from '../lib/state.svelte';
  import { t } from '../lib/i18n';

  let { onopenpassword, onopentos }: { onopenpassword: () => void; onopentos: () => void } = $props();

  let open = $state(false);
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div class="backdrop" onclick={() => open = false}></div>
{/if}

<div class="settings-wrap">
  <button class="gear-btn" onclick={() => open = !open} aria-label={t(chatState.lang, 'settings')}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z"/>
    </svg>
  </button>

  {#if open}
    <div class="dropdown">
      {#if chatState.availableModels.length > 0}
        <div class="row">
          <span class="label">{chatState.lang === 'zh' ? '模型' : 'Model'}</span>
          <div class="btn-group">
            {#each chatState.availableModels as m}
              <button
                class:active={chatState.model === `openclaw:${m.id}`}
                onclick={() => chatState.model = `openclaw:${m.id}`}
              >{m.name}</button>
            {/each}
          </div>
        </div>
      {/if}

      <div class="row">
        <span class="label">{chatState.lang === 'zh' ? '语言' : 'Language'}</span>
        <button class="toggle-btn" onclick={() => chatState.toggleLang()}>
          {t(chatState.lang, 'langSwitch')}
        </button>
      </div>

      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="row clickable" onclick={() => { onopenpassword(); open = false; }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <span>{t(chatState.lang, 'changePassword')}</span>
      </div>

      {#if chatState.warningDismissed}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="row clickable warning-row" onclick={() => { chatState.showWarning(); open = false; }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>{t(chatState.lang, 'warning')}</span>
        </div>
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="row clickable tos-row" onclick={() => { onopentos(); open = false; }}>
          <span>{t(chatState.lang, 'tosLink')}</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .settings-wrap {
    position: relative;
  }

  .gear-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text2);
    border-radius: 6px;
    padding: 6px 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .gear-btn:hover {
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
    min-width: 200px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--text);
  }

  .row.clickable {
    cursor: pointer;
    justify-content: flex-start;
  }
  .row.clickable:hover {
    background: var(--bg2);
  }

  .label {
    font-size: 13px;
    color: var(--text2);
    flex-shrink: 0;
  }

  .btn-group {
    display: flex;
    gap: 4px;
  }
  .btn-group button {
    background: none;
    border: 1px solid var(--border);
    color: var(--text2);
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  }
  .btn-group button:hover {
    background: var(--bg2);
  }
  .btn-group button.active {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  .toggle-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text2);
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  }
  .toggle-btn:hover {
    background: var(--bg2);
  }

  .warning-row {
    color: var(--warning-text);
    flex-wrap: wrap;
  }
  .warning-row span {
    flex: 1;
    min-width: 0;
  }

  .tos-row {
    padding-top: 0;
  }
  .tos-row span {
    text-decoration: underline;
    color: var(--text2);
    font-size: 12px;
  }
</style>
