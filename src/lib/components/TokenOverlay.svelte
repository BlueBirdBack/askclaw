<script lang="ts">
  interface Props {
    canDismiss?: boolean
    onCancel?: () => void
    onClear?: () => void
    onSave?: (token: string) => void
    open?: boolean
    value?: string
  }

  let {
    canDismiss = true,
    onCancel = () => {},
    onClear = () => {},
    onSave = () => {},
    open = false,
    value = '',
  }: Props = $props()

  let draft = $state('')

  $effect(() => {
    if (open) {
      draft = value
    }
  })

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault()

    const token = draft.trim()

    if (!token) {
      return
    }

    onSave(token)
  }

  function handleOverlayClick(event: MouseEvent) {
    if (canDismiss && event.target === event.currentTarget) {
      onCancel()
    }
  }

  function handleClear() {
    draft = ''
    onClear()
  }
</script>

<div
  class:active={open}
  class="overlay"
  role="dialog"
  aria-modal="true"
  aria-hidden={!open}
  aria-labelledby="modalTitle"
  onclick={handleOverlayClick}
>
  <form class="modal" onsubmit={handleSubmit}>
    <div class="modal-header">
      <span class="modal-icon" aria-hidden="true">&#128273;</span>
      <h2 id="modalTitle">API Token</h2>
    </div>

    <p class="modal-desc">Enter your Bearer token for `/bridge/*` requests. Stored locally in this browser only.</p>

    <label class="field-label" for="tokenInput">Token</label>
    <input
      id="tokenInput"
      bind:value={draft}
      type="password"
      autocomplete="off"
      spellcheck={false}
      placeholder="Paste your token here..."
    />

    <div class="modal-actions">
      <button class="btn" type="button" onclick={handleClear}>Clear</button>
      <button class="btn primary" type="submit" disabled={!draft.trim()}>Save</button>
    </div>
  </form>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(28, 26, 23, 0.35);
    backdrop-filter: blur(6px);
    z-index: 100;
  }

  .overlay.active {
    display: flex;
  }

  .modal {
    width: min(100%, 24rem);
    padding: 1.5rem;
    border-radius: 1.1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.04), 0 20px 60px rgba(0, 0, 0, 0.1);
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    margin-bottom: 0.5rem;
  }

  .modal-icon {
    font-size: 1.2rem;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .modal-desc {
    margin: 0 0 1rem;
    color: var(--text-muted);
    font-size: 0.845rem;
    line-height: 1.55;
  }

  .field-label {
    display: block;
    margin-bottom: 0.32rem;
    font-size: 0.76rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  input {
    width: 100%;
    border: 1.5px solid var(--border);
    border-radius: 0.65rem;
    background: var(--surface-2);
    color: var(--text);
    padding: 0.68rem 0.85rem;
    outline: none;
    transition: border-color 0.12s;
    font-size: 0.9rem;
  }

  input:focus {
    border-color: var(--accent);
  }

  .modal-actions {
    display: flex;
    gap: 0.45rem;
    justify-content: flex-end;
    margin-top: 1rem;
  }

  .btn {
    border: 1.5px solid var(--border);
    border-radius: 0.65rem;
    padding: 0.58rem 0.9rem;
    background: var(--surface);
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.86rem;
    transition: background 0.12s, border-color 0.12s, color 0.12s, opacity 0.12s;
  }

  .btn:hover {
    background: var(--surface-2);
    border-color: var(--border-s);
    color: var(--text);
  }

  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .btn.primary {
    border-color: var(--accent);
    background: var(--accent);
    color: #ffffff;
    font-weight: 500;
  }

  .btn.primary:hover {
    background: var(--accent-dark);
    border-color: var(--accent-dark);
  }
</style>
