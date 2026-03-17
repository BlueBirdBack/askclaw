<script lang="ts">
  import { compressImage } from '../compress'
  import type { PendingFile } from '../types'

  const MAX_FILE_SIZE = 50 * 1024 * 1024
  const MAX_FILES = 5
  const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
  const EXTRA_ALLOWED_TYPES = new Set([
    'application/gzip',
    'application/json',
    'application/msword',
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/xml',
    'application/x-7z-compressed',
    'application/x-gzip',
    'application/x-rar-compressed',
    'application/x-tar',
    'application/zip',
  ])
  const MIME_BY_EXTENSION: Record<string, string> = {
    c: 'text/plain',
    cfg: 'text/plain',
    cpp: 'text/plain',
    css: 'text/css',
    csv: 'text/csv',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    gif: 'image/gif',
    go: 'text/plain',
    gz: 'application/gzip',
    h: 'text/plain',
    html: 'text/html',
    ini: 'text/plain',
    java: 'text/plain',
    js: 'text/javascript',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    json: 'application/json',
    log: 'text/plain',
    markdown: 'text/markdown',
    md: 'text/markdown',
    pdf: 'application/pdf',
    png: 'image/png',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    py: 'text/plain',
    rar: 'application/x-rar-compressed',
    rb: 'text/plain',
    rs: 'text/plain',
    sh: 'text/plain',
    sql: 'text/plain',
    tar: 'application/x-tar',
    text: 'text/plain',
    toml: 'text/plain',
    ts: 'text/plain',
    txt: 'text/plain',
    webp: 'image/webp',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xml: 'application/xml',
    yaml: 'text/plain',
    yml: 'text/plain',
    zip: 'application/zip',
    '7z': 'application/x-7z-compressed',
  }
  const ACCEPT_ATTR = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.txt',
    '.md',
    '.markdown',
    '.json',
    '.xml',
    '.csv',
    '.html',
    '.css',
    '.js',
    '.ts',
    '.py',
    '.sh',
    '.yaml',
    '.yml',
    '.toml',
    '.ini',
    '.cfg',
    '.log',
    '.sql',
    '.rs',
    '.go',
    '.java',
    '.c',
    '.cpp',
    '.h',
    '.rb',
    '.zip',
    '.gz',
    '.tar',
    '.7z',
    '.rar',
  ].join(',')

  interface Props {
    disabled?: boolean
    isStreaming?: boolean
    onStop?: () => void
    onSubmit?: (text: string, files: PendingFile[]) => void | Promise<void>
    onUpdate?: (value: string) => void
    placeholder?: string
    value?: string
  }

  let {
    disabled = false,
    isStreaming = false,
    onStop = () => {},
    onSubmit = () => {},
    onUpdate = () => {},
    placeholder = 'Send a message',
    value = '',
  }: Props = $props()

  let textarea = $state<HTMLTextAreaElement | null>(null)
  let fileInput = $state<HTMLInputElement | null>(null)
  let pendingFiles = $state<PendingFile[]>([])
  let dragDepth = $state(0)
  let isDropTarget = $state(false)
  let isComposing = $state(false)
  let trimmedValue = $derived(value.trim())
  let hasPendingFiles = $derived(pendingFiles.length > 0)

  function getFileExtension(name: string): string {
    return name.split('.').pop()?.toLowerCase() ?? ''
  }

  function resolveType(file: File): string {
    if (file.type && file.type !== 'application/octet-stream') {
      return file.type
    }

    return MIME_BY_EXTENSION[getFileExtension(file.name)] ?? file.type ?? ''
  }

  function isAllowedFile(file: File): boolean {
    const resolvedType = resolveType(file)

    return resolvedType.startsWith('text/')
      || IMAGE_TYPES.has(resolvedType)
      || EXTRA_ALLOWED_TYPES.has(resolvedType)
      || Boolean(MIME_BY_EXTENSION[getFileExtension(file.name)])
  }

  function revokePreviewUrl(file: PendingFile) {
    if (file.previewUrl) {
      URL.revokeObjectURL(file.previewUrl)
    }
  }

  function clearPendingFiles() {
    for (const file of pendingFiles) {
      revokePreviewUrl(file)
    }

    pendingFiles = []
  }

  function syncHeight() {
    if (!textarea) {
      return
    }

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
  }

  function notify(message: string) {
    window.alert(message)
  }

  function addFiles(fileList: FileList | File[]) {
    if (disabled || isStreaming) {
      return
    }

    for (const file of Array.from(fileList)) {
      if (pendingFiles.length >= MAX_FILES) {
        notify(`You can attach up to ${MAX_FILES} files.`)
        break
      }

      if (!isAllowedFile(file)) {
        notify(`Unsupported file type: ${file.name}`)
        continue
      }

      if (file.size > MAX_FILE_SIZE) {
        notify(`${file.name} exceeds the 50MB limit.`)
        continue
      }

      const isImage = IMAGE_TYPES.has(resolveType(file))
      const pendingFile: PendingFile = {
        file,
        id: crypto.randomUUID(),
        isImage,
        previewUrl: isImage ? URL.createObjectURL(file) : '',
      }

      if (isImage) {
        pendingFile.ready = compressImage(file)
          .then((compressed) => {
            pendingFile.file = compressed
          })
          .catch(() => {})
      }

      pendingFiles = [...pendingFiles, pendingFile]
    }
  }

  function removeFile(fileId: string) {
    const target = pendingFiles.find((file) => file.id === fileId)

    if (!target) {
      return
    }

    revokePreviewUrl(target)
    pendingFiles = pendingFiles.filter((file) => file.id !== fileId)
  }

  function handleFileSelect(event: Event) {
    const input = event.currentTarget as HTMLInputElement

    if (input.files) {
      addFiles(input.files)
      input.value = ''
    }
  }

  function handlePaste(event: ClipboardEvent) {
    if (disabled || isStreaming) {
      return
    }

    const items = Array.from(event.clipboardData?.items ?? [])
    const files = items
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null)

    if (files.length === 0) {
      return
    }

    event.preventDefault()
    addFiles(files)
  }

  function dragHasFiles(event: DragEvent): boolean {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files')
  }

  function handleDragEnter(event: DragEvent) {
    if (!dragHasFiles(event) || disabled || isStreaming) {
      return
    }

    event.preventDefault()
    dragDepth += 1
    isDropTarget = true
  }

  function handleDragOver(event: DragEvent) {
    if (!dragHasFiles(event) || disabled || isStreaming) {
      return
    }

    event.preventDefault()

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy'
    }

    isDropTarget = true
  }

  function handleDragLeave(event: DragEvent) {
    if (!dragHasFiles(event) || disabled || isStreaming) {
      return
    }

    event.preventDefault()
    dragDepth = Math.max(0, dragDepth - 1)
    isDropTarget = dragDepth > 0
  }

  function handleDrop(event: DragEvent) {
    if (!dragHasFiles(event) || disabled || isStreaming) {
      return
    }

    event.preventDefault()
    dragDepth = 0
    isDropTarget = false

    if (event.dataTransfer?.files) {
      addFiles(event.dataTransfer.files)
    }
  }

  function handleInput(event: Event) {
    const target = event.currentTarget as HTMLTextAreaElement
    onUpdate(target.value)
    syncHeight()
  }

  function handleSubmit() {
    if (!trimmedValue && pendingFiles.length === 0) {
      return
    }

    const files = [...pendingFiles]
    clearPendingFiles()
    onSubmit(trimmedValue, files)
  }

  function handleFormSubmit(event: SubmitEvent) {
    event.preventDefault()

    if (isStreaming) {
      onStop()
      return
    }

    if (!disabled) {
      handleSubmit()
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || isComposing) {
      return
    }

    event.preventDefault()

    if (isStreaming) {
      onStop()
      return
    }

    if (!disabled) {
      handleSubmit()
    }
  }

  $effect(() => {
    value
    syncHeight()
  })
</script>

<form
  class="composer"
  autocomplete="off"
  onsubmit={handleFormSubmit}
  ondragenter={handleDragEnter}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  <div class:drop-target={isDropTarget} class="composer-box">
    {#if hasPendingFiles}
      <div class="preview-strip" aria-label="Attached files">
        {#each pendingFiles as file (file.id)}
          <div class="preview-card">
            {#if file.isImage}
              <img alt={file.file.name} class="preview-image" src={file.previewUrl} />
            {:else}
              <div class="preview-file">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.8"
                  />
                  <path
                    d="M14 3v5h5"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.8"
                  />
                </svg>
                <span>{getFileExtension(file.file.name).toUpperCase() || 'FILE'}</span>
              </div>
            {/if}

            <button
              aria-label={`Remove ${file.file.name}`}
              class="remove-file-btn"
              onclick={() => removeFile(file.id)}
              type="button"
            >
              ×
            </button>
            <div class="preview-name" title={file.file.name}>{file.file.name}</div>
          </div>
        {/each}
      </div>
    {/if}

    <button
      aria-label="Attach files"
      class="attach-btn"
      disabled={disabled || isStreaming}
      onclick={() => fileInput?.click()}
      title="Attach files"
      type="button"
    >
      <span aria-hidden="true">📎</span>
    </button>

    <input
      bind:this={fileInput}
      accept={ACCEPT_ATTR}
      hidden
      multiple
      onchange={handleFileSelect}
      type="file"
    />

    <textarea
      bind:this={textarea}
      aria-label="Message"
      disabled={disabled && !isStreaming}
      oninput={handleInput}
      onkeydown={handleKeydown}
      oncompositionstart={() => {
        isComposing = true
      }}
      oncompositionend={() => {
        isComposing = false
      }}
      onpaste={handlePaste}
      placeholder={placeholder}
      rows="1"
      value={value}
    ></textarea>

    <div class="composer-side">
      <button
        class:stop-mode={isStreaming}
        class="send-btn"
        type="submit"
        disabled={!isStreaming && (disabled || (!trimmedValue && !hasPendingFiles))}
        title={isStreaming ? 'Stop response' : 'Send message'}
      >
        {#if isStreaming}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect
              x="6"
              y="6"
              width="12"
              height="12"
              rx="2"
              fill="currentColor"
            />
          </svg>
        {:else}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <line
              x1="22"
              y1="2"
              x2="11"
              y2="13"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
            />
            <polygon
              points="22 2 15 22 11 13 2 9 22 2"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
            />
          </svg>
        {/if}
      </button>
    </div>
  </div>
</form>

<style>
  .composer {
    border-top: none;
    background: var(--surface);
    padding: 0.875rem 1.25rem calc(1rem + env(safe-area-inset-bottom, 0px));
    flex-shrink: 0;
  }

  .composer-box {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.6rem;
    align-items: end;
    width: min(100%, 50rem);
    margin: 0 auto;
    padding: 0.6rem 0.7rem;
    border-radius: 0.875rem;
    background: var(--surface-2);
    border: 1.5px solid var(--border);
    transition: border-color 0.15s;
  }

  .composer-box:focus-within {
    border-color: var(--accent);
  }

  .composer-box.drop-target {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent);
  }

  .preview-strip {
    grid-column: 1 / -1;
    display: flex;
    gap: 0.6rem;
    overflow-x: auto;
    padding-bottom: 0.1rem;
    scrollbar-width: thin;
  }

  .preview-card {
    position: relative;
    flex: 0 0 auto;
    width: 4rem;
  }

  .preview-image,
  .preview-file {
    width: 4rem;
    height: 4rem;
    border-radius: 0.8rem;
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--surface) 75%, white);
  }

  .preview-image {
    display: block;
    object-fit: cover;
  }

  .preview-file {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
    color: var(--text-dim);
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .preview-name {
    margin-top: 0.28rem;
    font-size: 0.66rem;
    color: var(--text-dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove-file-btn {
    position: absolute;
    top: -0.35rem;
    right: -0.35rem;
    width: 1.25rem;
    height: 1.25rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    line-height: 1;
    padding: 0;
  }

  .remove-file-btn:hover {
    background: var(--surface-2);
  }

  textarea {
    width: 100%;
    min-height: 2.35rem;
    max-height: 10rem;
    resize: none;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--text);
    padding: 0.2rem 0;
    line-height: 1.55;
    caret-color: var(--accent);
    font-size: 0.925rem;
  }

  textarea::placeholder {
    color: var(--text-dim);
  }

  .attach-btn {
    width: 2.4rem;
    height: 2.4rem;
    border: none;
    border-radius: 0.7rem;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.05rem;
    transition: background 0.12s, color 0.12s;
  }

  .attach-btn:hover {
    background: color-mix(in srgb, var(--accent) 10%, white);
    color: var(--accent);
  }

  .attach-btn:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .composer-side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.28rem;
  }

  .send-btn {
    width: 2.75rem;
    height: 2.75rem;
    border: none;
    border-radius: 0.65rem;
    cursor: pointer;
    background: var(--accent);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, transform 0.1s, opacity 0.12s;
  }

  .send-btn:hover {
    background: var(--accent-dark);
  }

  .send-btn:active {
    transform: scale(0.95);
  }

  .send-btn:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .send-btn.stop-mode {
    background: var(--danger);
  }

  @media (min-width: 840px) {
    .composer {
      padding: 1rem 1.5rem calc(1.25rem + env(safe-area-inset-bottom, 0px));
    }
  }
</style>
