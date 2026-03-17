<script lang="ts">
  import type { Agent } from '../stores/agents'

  interface Props {
    agents?: Agent[]
    currentAgentId: string
    onClose?: () => void
    onForward?: (targetAgentId: string) => void
    open?: boolean
  }

  let {
    agents = [],
    currentAgentId,
    onClose = () => {},
    onForward = () => {},
    open = false,
  }: Props = $props()

  let availableAgents = $derived(agents.filter((agent) => agent.id !== currentAgentId))

  function handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  function handleAgentClick(targetAgentId: string) {
    onForward(targetAgentId)
  }

  $effect(() => {
    if (!open) {
      return
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.removeEventListener('keydown', handleKeydown)
    }
  })
</script>

<div
  class:active={open}
  class="overlay"
  role="dialog"
  aria-modal="true"
  aria-hidden={!open}
  aria-labelledby="forwardModalTitle"
  onclick={handleOverlayClick}
>
  <div class="modal">
    <div class="header">
      <h2 id="forwardModalTitle">Forward to Agent</h2>
      <button class="close-btn" type="button" aria-label="Close forward dialog" onclick={onClose}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M18 6L6 18M6 6l12 12"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          />
        </svg>
      </button>
    </div>

    <p class="desc">Choose another agent to forward this message to.</p>

    <div class="agent-list">
      {#each availableAgents as agent (agent.id)}
        <button class="agent-pill" type="button" onclick={() => handleAgentClick(agent.id)}>
          <span class="emoji" aria-hidden="true">{agent.emoji ?? '🤖'}</span>
          <span>{agent.label}</span>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(28, 26, 23, 0.2);
    backdrop-filter: blur(4px);
    z-index: 110;
  }

  .overlay.active {
    display: flex;
  }

  .modal {
    width: min(100%, 24rem);
    padding: 1.2rem;
    border-radius: 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: 0 18px 60px rgba(0, 0, 0, 0.12);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .header h2 {
    margin: 0;
    font-size: 1rem;
    letter-spacing: -0.01em;
  }

  .close-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.12s, border-color 0.12s, background 0.12s;
  }

  .close-btn:hover {
    color: var(--text);
    border-color: var(--border-s);
    background: color-mix(in srgb, var(--surface-2) 72%, white);
  }

  .desc {
    margin: 0.7rem 0 0;
    color: var(--text-muted);
    font-size: 0.86rem;
    line-height: 1.5;
  }

  .agent-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
    margin-top: 1rem;
  }

  .agent-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.7rem 0.95rem;
    background: var(--surface-2);
    color: var(--text);
    font: inherit;
    cursor: pointer;
    transition: transform 0.12s, border-color 0.12s, background 0.12s;
  }

  .agent-pill:hover {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
    background: color-mix(in srgb, var(--accent) 10%, var(--surface-2));
  }

  .emoji {
    font-size: 1rem;
  }
</style>
