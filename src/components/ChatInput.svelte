<script lang="ts">
  import { chatState } from '../lib/state.svelte';
  import { t } from '../lib/i18n';
  import { compressImage } from '../lib/compress';
  import type { PendingFile } from '../lib/types';

  const MAX_SIZE = 50 * 1024 * 1024;
  const MAX_FILES = 5;
  const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
  const ALLOWED_TYPES = new Set([
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    // PDF
    'application/pdf',
    // Office
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
    // Text / code
    'text/plain', 'text/csv', 'text/html', 'text/css', 'text/javascript',
    'text/markdown', 'text/xml',
    'application/json', 'application/xml',
    // Archives
    'application/zip', 'application/gzip', 'application/x-tar',
    'application/x-7z-compressed', 'application/x-rar-compressed',
  ]);
  // Browsers often report empty or generic MIME for these extensions
  const EXT_TO_MIME: Record<string, string> = {
    md: 'text/markdown', markdown: 'text/markdown',
    txt: 'text/plain', csv: 'text/csv', json: 'application/json',
    xml: 'application/xml', html: 'text/html', css: 'text/css',
    js: 'text/javascript', ts: 'text/plain', py: 'text/plain',
    sh: 'text/plain', yaml: 'text/plain', yml: 'text/plain',
    toml: 'text/plain', ini: 'text/plain', cfg: 'text/plain',
    log: 'text/plain', sql: 'text/plain', rs: 'text/plain',
    go: 'text/plain', java: 'text/plain', c: 'text/plain',
    cpp: 'text/plain', h: 'text/plain', rb: 'text/plain',
  };

  function resolveType(file: File): string {
    if (file.type && file.type !== 'application/octet-stream') return file.type;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    return EXT_TO_MIME[ext] ?? file.type;
  }

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
        alert(t(chatState.lang, 'tooManyFiles'));
        break;
      }
      const mime = resolveType(file);
      if (!ALLOWED_TYPES.has(mime)) {
        alert(t(chatState.lang, 'unsupportedType'));
        continue;
      }
      if (file.size > MAX_SIZE) {
        alert(t(chatState.lang, 'fileTooLarge'));
        continue;
      }
      const id = crypto.randomUUID();
      const isImage = IMAGE_TYPES.has(mime);
      chatState.pendingFiles.push({
        id,
        file,
        previewUrl: isImage ? URL.createObjectURL(file) : '',
        isImage,
      });
      // Compress images in background — preview shows immediately
      if (isImage) {
        chatState.pendingFiles[chatState.pendingFiles.length - 1].ready =
          compressImage(file).then(compressed => {
            const pf = chatState.pendingFiles.find(f => f.id === id);
            if (pf) pf.file = compressed;
          });
      }
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
      if (chatState.pendingFiles[idx].isImage) {
        URL.revokeObjectURL(chatState.pendingFiles[idx].previewUrl);
      }
      chatState.pendingFiles.splice(idx, 1);
    }
  }

  function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedFiles: File[] = [];
    for (const item of items) {
      if (ALLOWED_TYPES.has(item.type)) {
        const file = item.getAsFile();
        if (file) pastedFiles.push(file);
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      addFiles(pastedFiles);
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files) {
      const validFiles = Array.from(files).filter(f => ALLOWED_TYPES.has(f.type));
      if (validFiles.length > 0) addFiles(validFiles);
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
          {#if pf.isImage}
            <img src={pf.previewUrl} alt={pf.file.name} />
          {:else}
            <div class="file-icon" title={pf.file.name}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              <span class="file-ext">{pf.file.name.split('.').pop()}</span>
            </div>
          {/if}
          <button class="remove-btn" onclick={() => removeFile(pf.id)} aria-label={t(chatState.lang, 'removeFile')}>&times;</button>
        </div>
      {/each}
    </div>
  {/if}
  <form onsubmit={handleSubmit}>
    <button type="button" class="attach-btn" onclick={() => fileInput.click()} title={t(chatState.lang, 'attachFile')}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
    </button>
    <input
      bind:this={fileInput}
      type="file"
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
  .file-icon {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--bg2);
    color: var(--text2);
    gap: 2px;
  }
  .file-ext {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    max-width: 56px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
