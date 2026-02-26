<script lang="ts">
  import { chatState } from '../lib/state.svelte';
  import { t } from '../lib/i18n';

  let { onsend }: { onsend: (text: string) => void } = $props();
  let textarea: HTMLTextAreaElement;

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const text = textarea.value.trim();
    if (!text || chatState.streaming) return;
    textarea.value = '';
    textarea.style.height = 'auto';
    onsend(text);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      textarea.form?.requestSubmit();
    }
  }

  function autoGrow() {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  export function focus() {
    textarea?.focus();
  }
</script>

<div class="input-bar">
  <form onsubmit={handleSubmit}>
    <select
      bind:value={chatState.model}
      title="Model"
    >
      <option value="openclaw:main">Sonnet</option>
      <option value="openclaw:opus">Opus</option>
    </select>
    <textarea
      bind:this={textarea}
      placeholder={t(chatState.lang, 'placeholder')}
      rows="1"
      autocomplete="off"
      oninput={autoGrow}
      onkeydown={handleKeydown}
    ></textarea>
    <button type="submit" disabled={chatState.streaming} aria-label="Send">
      &#8593;
    </button>
  </form>
</div>

<style>
  .input-bar {
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
    background: var(--bg);
  }
  form {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }
  select {
    background: var(--input-bg);
    color: var(--text2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 8px;
    font-size: 13px;
    font-family: inherit;
    outline: none;
    cursor: pointer;
    flex-shrink: 0;
  }
  select:focus {
    border-color: var(--accent);
  }
  textarea {
    flex: 1;
    resize: none;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 10px 14px;
    font-size: 16px;
    font-family: inherit;
    line-height: 1.4;
    background: var(--input-bg);
    color: var(--text);
    outline: none;
    max-height: 120px;
    min-height: 44px;
  }
  textarea:focus {
    border-color: var(--accent);
  }
  button {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 12px;
    width: 44px;
    height: 44px;
    font-size: 18px;
    cursor: pointer;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
  }
  button:hover {
    background: var(--accent2);
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
