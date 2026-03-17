<script lang="ts">
  import { searchMessages, type ChatSummary, type SearchResult } from '../api'

  interface SearchGroup {
    chatId: string
    results: SearchResult[]
    title: string
  }

  interface Props {
    activeChatId?: string | null
    chats?: ChatSummary[]
    onClose?: () => void
    onDeleteChat?: (chat: ChatSummary) => void
    onNewChat?: () => void
    onSelectChat?: (chatId: string, messageId?: number) => void
    open?: boolean
    token?: string
  }

  let {
    activeChatId = null,
    chats = [],
    onClose = () => {},
    onDeleteChat = () => {},
    onNewChat = () => {},
    onSelectChat = () => {},
    open = false,
    token = '',
  }: Props = $props()

  let searchQuery = $state('')
  let searchResults: SearchResult[] = $state([])
  let searching = $state(false)
  let composing = $state(false)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  let groupedResults = $derived.by(() => {
    const groups = new Map<string, SearchGroup>()

    for (const result of searchResults) {
      const existing = groups.get(result.chat_id)
      if (existing) {
        existing.results.push(result)
        continue
      }

      groups.set(result.chat_id, {
        chatId: result.chat_id,
        results: [result],
        title: result.chat_title,
      })
    }

    return Array.from(groups.values())
  })

  function runSearch() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    if (composing || !token) {
      return
    }

    const nextQuery = searchQuery.trim()
    if (nextQuery.length < 2) {
      searchResults = []
      searching = false
      return
    }

    searching = true
    debounceTimer = setTimeout(async () => {
      searchResults = await searchMessages(nextQuery, token)
      searching = false
    }, 300)
  }

  function formatRelativeTime(value: string): string {
    const timestamp = Date.parse(value)
    if (Number.isNaN(timestamp)) {
      return ''
    }

    const diffMs = Date.now() - timestamp
    const diffMinutes = Math.floor(diffMs / 60000)
    if (diffMinutes < 1) return 'now'
    if (diffMinutes < 60) return `${diffMinutes}m`

    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h`

    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 30) return `${diffDays}d`

    return new Date(timestamp).toLocaleDateString()
  }

  $effect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (open && window.innerWidth < 768) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  })
</script>

{#if open}
  <button class="sidebar-backdrop" type="button" aria-label="Close chats" onclick={onClose}></button>
{/if}

<aside class:open class="sidebar">
  <div class="sidebar-header">
    <div>
      <p class="eyebrow">History</p>
      <h2>Chats</h2>
    </div>

    <button class="new-chat-btn" type="button" title="New chat" onclick={onNewChat}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-linecap="round" stroke-width="2.2" />
      </svg>
    </button>
  </div>

  <label class="search-box" aria-label="Search chats">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
    </svg>
    <input
      type="text"
      placeholder="Search messages"
      value={searchQuery}
      oncompositionend={() => {
        composing = false
        runSearch()
      }}
      oncompositionstart={() => {
        composing = true
      }}
      oninput={(event) => {
        searchQuery = (event.currentTarget as HTMLInputElement).value
        runSearch()
      }}
    />
  </label>

  <div class="sidebar-body">
    {#if searchQuery.trim().length >= 2}
      {#if searching}
        <div class="empty-state">Searching...</div>
      {:else if groupedResults.length === 0}
        <div class="empty-state">No results</div>
      {:else}
        <div class="results-list">
          {#each groupedResults as group (group.chatId)}
            <section class="result-group">
              <button class="result-chat" type="button" onclick={() => onSelectChat(group.chatId, group.results[0]?.message_id)}>
                <span class="chat-title">{group.title || 'Untitled chat'}</span>
                <span class="result-count">{group.results.length} match{group.results.length === 1 ? '' : 'es'}</span>
              </button>

              {#each group.results.slice(0, 3) as result (result.message_id)}
                <button class="result-item" type="button" onclick={() => onSelectChat(group.chatId, result.message_id)}>
                  <span class="result-role">{result.role === 'assistant' ? 'Assistant' : 'You'}</span>
                  <span class="result-snippet">{result.snippet}</span>
                </button>
              {/each}
            </section>
          {/each}
        </div>
      {/if}
    {:else if chats.length === 0}
      <div class="empty-state">No chats yet</div>
    {:else}
      <div class="chat-list">
        {#each chats as chat (chat.id)}
          <div class:active={activeChatId === chat.id} class="chat-item">
            <button class="chat-item-btn" type="button" onclick={() => onSelectChat(chat.id)}>
              <span class="chat-title">{chat.title || 'Untitled chat'}</span>
              <span class="chat-meta">{chat.agent_id} · {formatRelativeTime(chat.updated_at)}</span>
            </button>

            <button class="delete-btn" type="button" title="Delete chat" onclick={() => onDeleteChat(chat)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-linecap="round" stroke-width="2.2" />
              </svg>
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</aside>

<style>
  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(28, 26, 23, 0.3);
    border: 0;
    z-index: 20;
  }

  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    width: min(88vw, 20rem);
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    z-index: 30;
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 1rem 1rem 0.8rem;
    border-bottom: 1px solid var(--border);
  }

  .eyebrow {
    margin: 0 0 0.2rem;
    color: var(--text-dim);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  h2 {
    margin: 0;
    font-size: 1rem;
    letter-spacing: -0.02em;
  }

  .new-chat-btn,
  .delete-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-muted);
    border-radius: 0.65rem;
    cursor: pointer;
    transition: border-color 0.12s, color 0.12s, background 0.12s, opacity 0.12s;
  }

  .new-chat-btn {
    width: 2.3rem;
    height: 2.3rem;
  }

  .delete-btn {
    width: 1.9rem;
    height: 1.9rem;
    opacity: 0.9;
  }

  .new-chat-btn:hover,
  .delete-btn:hover {
    border-color: var(--border-s);
    color: var(--text);
    background: var(--surface-2);
  }

  .search-box {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 0.6rem;
    margin: 0.9rem 1rem 0;
    padding: 0.7rem 0.8rem;
    border: 1px solid var(--border);
    border-radius: 0.85rem;
    background: var(--surface-2);
    color: var(--text-muted);
  }

  .search-box:focus-within {
    border-color: var(--accent);
    color: var(--accent);
  }

  .search-box input {
    width: 100%;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--text);
    font-size: 0.9rem;
  }

  .search-box input::placeholder {
    color: var(--text-dim);
  }

  .sidebar-body {
    min-height: 0;
    overflow-y: auto;
    padding: 0.85rem 0.8rem 1rem;
  }

  .chat-list,
  .results-list {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .chat-item,
  .result-group {
    border: 1px solid var(--border);
    border-radius: 0.95rem;
    background: var(--surface);
  }

  .chat-item.active {
    border-color: color-mix(in srgb, var(--accent) 28%, var(--border));
    background: color-mix(in srgb, var(--accent) 6%, white);
  }

  .chat-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.45rem;
    padding: 0.35rem;
  }

  .chat-item-btn,
  .result-chat,
  .result-item {
    width: 100%;
    border: 0;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .chat-item-btn,
  .result-chat {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
    padding: 0.5rem 0.55rem;
  }

  .chat-title {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chat-meta,
  .result-count,
  .result-role {
    font-size: 0.74rem;
    color: var(--text-muted);
  }

  .result-group {
    padding: 0.4rem;
  }

  .result-item {
    display: grid;
    gap: 0.18rem;
    padding: 0.55rem;
    border-radius: 0.75rem;
  }

  .result-item:hover,
  .chat-item-btn:hover,
  .result-chat:hover {
    background: var(--surface-2);
    border-radius: 0.75rem;
  }

  .result-snippet {
    color: var(--text);
    font-size: 0.82rem;
    line-height: 1.45;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .empty-state {
    display: grid;
    place-items: center;
    min-height: 10rem;
    color: var(--text-muted);
    font-size: 0.86rem;
  }

  @media (hover: hover) {
    .chat-item:not(.active) .delete-btn {
      opacity: 0;
    }

    .chat-item:hover .delete-btn,
    .delete-btn:focus-visible {
      opacity: 1;
    }
  }

  @media (min-width: 768px) {
    .sidebar-backdrop {
      display: none;
    }

    .sidebar {
      position: relative;
      inset: auto;
      width: auto;
      min-width: 0;
      transform: none;
      z-index: auto;
    }
  }
</style>
