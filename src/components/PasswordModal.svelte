<script lang="ts">
  import { chatState } from '../lib/state.svelte';
  import { t } from '../lib/i18n';
  import { changePassword } from '../lib/api';

  let { open, onclose }: { open: boolean; onclose: () => void } = $props();

  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let status = $state<'idle' | 'loading' | 'success' | 'error'>('idle');
  let errorMsg = $state('');

  function reset() {
    currentPassword = '';
    newPassword = '';
    confirmPassword = '';
    status = 'idle';
    errorMsg = '';
  }

  function close() {
    reset();
    onclose();
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (status === 'loading') return;

    if (newPassword !== confirmPassword) {
      status = 'error';
      errorMsg = t(chatState.lang, 'passwordMismatch');
      return;
    }

    status = 'loading';
    try {
      await changePassword(currentPassword, newPassword);
      status = 'success';
    } catch (err: any) {
      status = 'error';
      if (err?.status === 403) {
        errorMsg = t(chatState.lang, 'passwordWrong');
      } else {
        errorMsg = t(chatState.lang, 'passwordError');
      }
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onkeydown={(e) => e.key === 'Escape' && close()} onclick={close}>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title">{t(chatState.lang, 'changePassword')}</h2>
        <button type="button" class="modal-x" onclick={close}>&times;</button>
      </div>

      {#if status === 'success'}
        <div class="modal-body">
          <p class="success">{t(chatState.lang, 'passwordChanged')}</p>
        </div>
        <button type="button" class="modal-close" onclick={close}>OK</button>
      {:else}
        <form class="modal-body" onsubmit={handleSubmit}>
          <input type="text" name="username" autocomplete="username" value={chatState.username} class="sr-only" tabindex="-1" aria-hidden="true" readonly />
          <label>
            <span>{t(chatState.lang, 'currentPassword')}</span>
            <input type="password" bind:value={currentPassword} required autocomplete="current-password" />
          </label>
          <label>
            <span>{t(chatState.lang, 'newPassword')}</span>
            <input type="password" bind:value={newPassword} required minlength="4" autocomplete="new-password" />
          </label>
          <label>
            <span>{t(chatState.lang, 'confirmPassword')}</span>
            <input type="password" bind:value={confirmPassword} required minlength="4" autocomplete="new-password" />
          </label>

          {#if status === 'error'}
            <p class="error">{errorMsg}</p>
          {/if}

          <button type="submit" class="submit-btn" disabled={status === 'loading'}>
            {status === 'loading' ? '...' : t(chatState.lang, 'changePassword')}
          </button>
        </form>
      {/if}
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
    max-width: 400px;
    width: 100%;
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
    padding: 16px 24px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  label span {
    font-size: 13px;
    color: var(--text2);
  }

  input {
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    background: var(--bg);
    color: var(--text);
  }

  input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .submit-btn {
    padding: 10px 24px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-family: inherit;
    cursor: pointer;
    margin-top: 4px;
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--accent2);
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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
  }

  .modal-close:hover {
    background: var(--accent2);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }

  .error {
    color: #e74c3c;
    font-size: 13px;
    margin: 0;
  }

  .success {
    color: #27ae60;
    font-size: 15px;
    text-align: center;
    margin: 8px 0;
  }
</style>
