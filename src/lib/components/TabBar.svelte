<script lang="ts">
  import StatusDot from './StatusDot.svelte'
  import type { Agent } from '../stores/agents'
  import type { ConnectionStatus } from '../stores/chat'

  interface Props {
    activeAgentId?: string
    agents?: Agent[]
    hasMessages?: boolean
    onExportMarkdown?: () => void
    onExportText?: () => void
    onExportJson?: () => void
    onNewChat?: () => void
    onOpenTokenOverlay?: () => void
    onSelectAgent?: (agentId: string) => void
    onToggleSidebar?: () => void
    status?: ConnectionStatus
  }

  let {
    activeAgentId = '',
    agents = [],
    hasMessages = false,
    onExportMarkdown = () => {},
    onExportText = () => {},
    onExportJson = () => {},
    onNewChat = () => {},
    onOpenTokenOverlay = () => {},
    onSelectAgent = () => {},
    onToggleSidebar = () => {},
    status = 'ready',
  }: Props = $props()

  let exportOpen = $state(false)
</script>

<header class="topbar">
  <div class="brand">
    <button class="menu-btn" type="button" title="Open chats" onclick={onToggleSidebar}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-linecap="round" stroke-width="2.2" />
      </svg>
    </button>

    <StatusDot {status} />
  </div>

  <div class="topbar-actions">
    {#if hasMessages}
      <div class="export-wrap">
        <button class="icon-btn" type="button" title="Export chat" onclick={() => exportOpen = !exportOpen}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" />
          </svg>
        </button>
        {#if exportOpen}
          <button class="export-backdrop" type="button" onclick={() => exportOpen = false} aria-label="Close"></button>
          <div class="export-dropdown">
            <button class="export-item" type="button" onclick={() => { onExportMarkdown(); exportOpen = false; }}>Markdown (.md)</button>
            <button class="export-item" type="button" onclick={() => { onExportText(); exportOpen = false; }}>Text (.txt)</button>
            <button class="export-item" type="button" onclick={() => { onExportJson(); exportOpen = false; }}>JSON (.json)</button>
          </div>
        {/if}
      </div>
    {/if}

    <button class="icon-btn" type="button" title="New conversation" onclick={onNewChat}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2.2"
        />
      </svg>
    </button>

    <button class="icon-btn" type="button" title="API token" onclick={onOpenTokenOverlay}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect
          x="3"
          y="11"
          width="18"
          height="11"
          rx="2"
          ry="2"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2.2"
        />
        <path
          d="M7 11V7a5 5 0 0 1 10 0v4"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2.2"
        />
      </svg>
    </button>
  </div>
</header>

<div class="tab-bar" role="tablist" aria-label="Agents">
  {#each agents as agent (agent.id)}
    <button
      aria-selected={activeAgentId === agent.id}
      class:active={activeAgentId === agent.id}
      class="tab-item"
      onclick={() => onSelectAgent(agent.id)}
      role="tab"
      type="button"
    >
      <span class="tab-label">{agent.label}</span>
    </button>
  {/each}
</div>

<style>
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .menu-btn,
  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-muted);
    border-radius: 0.65rem;
    min-width: 2.25rem;
    min-height: 2.25rem;
    padding: 0 0.6rem;
    cursor: pointer;
    font-size: 0.8rem;
    transition: border-color 0.12s, color 0.12s, background 0.12s;
  }

  .menu-btn:hover,
  .icon-btn:hover {
    border-color: var(--border-s);
    color: var(--text);
    background: var(--surface-2);
  }

  .menu-btn:active,
  .icon-btn:active {
    opacity: 0.75;
  }

  .topbar-actions {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-shrink: 0;
  }

  .tab-bar {
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    padding: 0 0.75rem;
    gap: 0;
  }

  .tab-bar::-webkit-scrollbar {
    display: none;
  }

  .tab-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.55rem 0.75rem;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    position: relative;
    transition: color 0.15s;
    flex-shrink: 0;
  }

  .tab-item:hover {
    color: var(--text);
  }

  .tab-item.active {
    color: var(--accent);
    font-weight: 600;
  }

  .tab-item.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0.5rem;
    right: 0.5rem;
    height: 2.5px;
    background: var(--accent);
    border-radius: 2px 2px 0 0;
  }

  .tab-label {
    font-size: 0.78rem;
  }

  .export-wrap {
    position: relative;
  }

  .export-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
    background: transparent;
    border: none;
    cursor: default;
  }

  .export-dropdown {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 0.65rem;
    padding: 0.35rem;
    min-width: 140px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .export-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.4rem 0.6rem;
    border: none;
    background: transparent;
    color: var(--text);
    font-size: 0.78rem;
    border-radius: 0.4rem;
    cursor: pointer;
    font-family: inherit;
  }

  .export-item:hover {
    background: var(--surface-2);
  }

  @media (min-width: 768px) {
    .menu-btn {
      display: none;
    }

    .topbar {
      padding: 0.875rem 1.25rem;
    }
  }
</style>
