<script lang="ts">
  import { onMount } from 'svelte';
  import { chatState } from '../lib/state.svelte';
  import { t } from '../lib/i18n';
  import { fetchChats, fetchChat, deleteChat, searchMessages } from '../lib/api';
  import type { SearchResult } from '../lib/types';

  let searchQuery = $state('');
  let searchResults: SearchResult[] = $state([]);
  let searching = $state(false);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  onMount(() => {
    loadChats();
  });

  // Lock body scroll when sidebar overlay is open on mobile
  $effect(() => {
    const isMobile = window.innerWidth < 768;
    if (chatState.sidebarOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  });

  async function loadChats() {
    chatState.chatList = await fetchChats();
  }

  // Expose refresh for parent to call after stream completes
  export function refresh() {
    loadChats();
  }

  function handleSearchInput() {
    clearTimeout(debounceTimer);
    const q = searchQuery.trim();
    if (!q) {
      searchResults = [];
      searching = false;
      return;
    }
    searching = true;
    debounceTimer = setTimeout(async () => {
      searchResults = await searchMessages(q);
      searching = false;
    }, 300);
  }

  async function openChat(chatId: string, messageId?: number) {
    const detail = await fetchChat(chatId);
    if (detail) {
      chatState.loadChat(detail, messageId);
    }
    // On mobile, close sidebar after selecting
    if (window.innerWidth < 768) {
      chatState.sidebarOpen = false;
    }
  }

  async function handleDelete(e: MouseEvent, chatId: string) {
    e.stopPropagation();
    if (!confirm(t(chatState.lang, 'confirmDelete'))) return;
    const ok = await deleteChat(chatId);
    if (ok) {
      chatState.chatList = chatState.chatList.filter((c) => c.id !== chatId);
      if (chatState.currentChatId === chatId) {
        chatState.newChat();
      }
    }
  }

  function handleNewChat() {
    chatState.newChat();
    if (window.innerWidth < 768) {
      chatState.sidebarOpen = false;
    }
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'Z');
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return chatState.lang === 'zh' ? '刚刚' : 'now';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d`;
    return date.toLocaleDateString();
  }

  // Group search results by chat
  let groupedResults = $derived(() => {
    const groups: Map<string, { title: string; results: SearchResult[] }> = new Map();
    for (const r of searchResults) {
      if (!groups.has(r.chat_id)) {
        groups.set(r.chat_id, { title: r.chat_title, results: [] });
      }
      groups.get(r.chat_id)!.results.push(r);
    }
    return groups;
  });
</script>

<aside class="sidebar" class:open={chatState.sidebarOpen}>
  <div class="sidebar-header">
    <h2>Ask Claw</h2>
    <button class="new-chat-btn" onclick={handleNewChat} title={t(chatState.lang, 'newChat')}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  </div>

  <div class="search-box">
    <input
      type="text"
      placeholder={t(chatState.lang, 'searchChats')}
      bind:value={searchQuery}
      oninput={handleSearchInput}
    />
  </div>

  <div class="chat-list">
    {#if searchQuery.trim()}
      <!-- Search results mode -->
      {#if searching}
        <div class="empty">&hellip;</div>
      {:else if searchResults.length === 0}
        <div class="empty">{t(chatState.lang, 'noChats')}</div>
      {:else}
        {#each [...groupedResults().entries()] as [chatId, group]}
          <button class="search-result" onclick={() => openChat(chatId, group.results[0].message_id)}>
            <span class="chat-title">{group.title || t(chatState.lang, 'untitled')}</span>
            <span class="snippet">{@html group.results[0].snippet}</span>
          </button>
        {/each}
      {/if}
    {:else}
      <!-- Normal chat list mode -->
      {#if chatState.chatList.length === 0}
        <div class="empty">{t(chatState.lang, 'noChats')}</div>
      {:else}
        {#each chatState.chatList as chat (chat.id)}
          <div
            class="chat-item"
            class:active={chatState.currentChatId === chat.id}
          >
            <button class="chat-item-btn" onclick={() => openChat(chat.id)}>
              <span class="chat-title">{chat.title || t(chatState.lang, 'untitled')}</span>
              <span class="chat-date">{formatDate(chat.updated_at)}</span>
            </button>
            <button
              class="delete-btn"
              onclick={(e) => handleDelete(e, chat.id)}
              title={t(chatState.lang, 'deleteChat')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        {/each}
      {/if}
    {/if}
  </div>
</aside>

<style>
  .sidebar {
    width: var(--sidebar-width);
    height: 100dvh;
    background: var(--sidebar-bg);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    overflow: hidden;
  }

  .sidebar-header {
    padding: 12px 12px 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .sidebar-header h2 {
    font-size: 16px;
    font-weight: 600;
  }

  .new-chat-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text2);
    border-radius: 6px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .new-chat-btn:hover {
    background: var(--bg3);
  }

  .search-box {
    padding: 0 12px 8px;
    flex-shrink: 0;
  }
  .search-box input {
    width: 100%;
    padding: 7px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--text);
    font-size: 13px;
    font-family: inherit;
    outline: none;
  }
  .search-box input:focus {
    border-color: var(--accent);
  }

  .chat-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 8px 8px;
  }

  .chat-item {
    display: flex;
    align-items: center;
    width: 100%;
    border-radius: 6px;
    position: relative;
  }
  .chat-item:hover {
    background: var(--bg3);
  }
  .chat-item.active {
    background: var(--bg3);
  }

  .chat-item-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 1;
    min-width: 0;
    padding: 8px 8px;
    border: none;
    background: none;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    color: var(--text);
    font-size: 13px;
    font-family: inherit;
    gap: 8px;
  }

  .chat-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chat-date {
    color: var(--text3);
    font-size: 11px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .delete-btn {
    background: none;
    border: none;
    color: var(--text3);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    opacity: 0;
    transition: opacity 0.15s;
    flex-shrink: 0;
    margin-right: 4px;
  }
  .chat-item:hover .delete-btn {
    opacity: 1;
  }
  .delete-btn:hover {
    color: #e55;
    background: var(--bg2);
  }
  /* Touch devices have no hover — always show delete button */
  @media (hover: none) {
    .delete-btn {
      opacity: 0.6;
    }
  }

  .empty {
    text-align: center;
    color: var(--text3);
    font-size: 13px;
    padding: 20px 8px;
  }

  .search-result {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    padding: 8px;
    border: none;
    background: none;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    color: var(--text);
    font-size: 13px;
    font-family: inherit;
    gap: 2px;
  }
  .search-result:hover {
    background: var(--bg3);
  }
  .search-result .snippet {
    font-size: 11px;
    color: var(--text3);
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  /* Mobile: hidden by default, shown as overlay when open */
  @media (max-width: 767px) {
    .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      z-index: 100;
      transform: translateX(-100%);
      transition: transform 0.2s ease;
    }
    .sidebar.open {
      transform: translateX(0);
    }
  }

  @media (min-width: 768px) {
    .sidebar {
      display: flex;
    }
  }
</style>
