<script lang="ts">
  import { chatState } from '../lib/state.svelte';
  import { t } from '../lib/i18n';
  import type { PendingFile } from '../lib/types';

  const MAX_SIZE = 5 * 1024 * 1024;
  const MAX_FILES = 5;
  const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

  let { onsend }: { onsend: (text: string, files: PendingFile[]) => void } = $props();
  let textarea: HTMLTextAreaElement;
  let fileInput: HTMLInputElement;

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const text = textarea.value.trim();
    if ((!text && chatState.pendingFiles.length === 0) || chatState.streaming) return;
    textarea.value = '';
    textarea.style.height = 'auto';
    const files = [...chatState.pendingFiles];
    chatState.pendingFiles = [];
    onsend(text, files);
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

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    for (const file of files) {
      if (chatState.pendingFiles.length >= MAX_FILES) {
        alert(t(chatState.lang, 'tooManyImages'));
        break;
      }
      if (!ALLOWED_TYPES.has(file.type)) {
        alert(t(chatState.lang, 'unsupportedType'));
        continue;
      }
      if (file.size > MAX_SIZE) {
        alert(t(chatState.lang, 'imageTooLarge'));
        continue;
      }
      chatState.pendingFiles.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files) {
      addFiles(input.files);
      input.value = '';
    }
  }

  function removeFile(id: string) {
    const idx = chatState.pendingFiles.findIndex(f => f.id === id);
    if (idx >= 0) {
      URL.revokeObjectURL(chatState.pendingFiles[idx].previewUrl);
      chatState.pendingFiles.splice(idx, 1);
    }
  }

  function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      addFiles(imageFiles);
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files) {
      const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
      if (imageFiles.length > 0) addFiles(imageFiles);
    }
  }

  export function focus() {
    textarea?.focus();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="input-bar" ondragover={handleDragOver} ondrop={handleDrop}>
  {#if chatState.pendingFiles.length > 0}
    <div class="preview-strip">
      {#each chatState.pendingFiles as pf (pf.id)}
        <div class="preview-thumb">
          <img src={pf.previewUrl} alt={pf.file.name} />
          <button class="remove-btn" onclick={() => removeFile(pf.id)} aria-label={t(chatState.lang, 'removeImage')}>&times;</button>
        </div>
      {/each}
    </div>
  {/if}
  <form onsubmit={handleSubmit}>
    <select
      bind:value={chatState.model}
      title="Model"
    >
      <option value="openclaw:main">Sonnet</option>
      <option value="openclaw:opus">Opus</option>
    </select>
    <button type="button" class="attach-btn" onclick={() => fileInput.click()} title={t(chatState.lang, 'attachImage')}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
    </button>
    <input
      bind:this={fileInput}
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp"
      multiple
      hidden
      onchange={handleFileSelect}
    />
    <textarea
      bind:this={textarea}
      placeholder={t(chatState.lang, 'placeholder')}
      rows="1"
      autocomplete="off"
      oninput={autoGrow}
      onkeydown={handleKeydown}
      onpaste={handlePaste}
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
  .preview-strip {
    display: flex;
    gap: 8px;
    padding-bottom: 8px;
    overflow-x: auto;
  }
  .preview-thumb {
    position: relative;
    width: 64px;
    height: 64px;
    flex-shrink: 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border);
  }
  .preview-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .remove-btn {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
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
  .attach-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text2);
    cursor: pointer;
    padding: 6px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    width: 44px;
  }
  .attach-btn:hover {
    background: var(--bg2);
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
  button[type="submit"] {
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
  button[type="submit"]:hover {
    background: var(--accent2);
  }
  button[type="submit"]:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
