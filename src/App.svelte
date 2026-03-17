<script lang="ts">
  import { get } from 'svelte/store'

  import {
    deleteChat as deleteChatRequest,
    fetchChat,
    fetchChats,
    forwardMessage,
    getHealth,
    loadChat as loadChatRequest,
    type ChatSummary,
  } from './lib/api'
  import Sidebar from './lib/components/Sidebar.svelte'
  import ChatArea from './lib/components/ChatArea.svelte'
  import Composer from './lib/components/Composer.svelte'
  import ForwardModal from './lib/components/ForwardModal.svelte'
  import TabBar from './lib/components/TabBar.svelte'
  import TokenOverlay from './lib/components/TokenOverlay.svelte'
  import { exportChatAsMarkdown, exportChatAsText, exportChatAsJson } from './lib/export'
  import { agents, type Agent } from './lib/stores/agents'
  import { authToken, redactSensitiveAuth } from './lib/stores/auth'
  import { chat, currentSession, type ConnectionStatus, type ChatMessage } from './lib/stores/chat'
  import type { PendingFile } from './lib/types'

  let agentItems: Agent[] = $state([])
  let agentError: string | null = $state(null)
  let agentLoading = $state(false)
  let token = $state(get(authToken))
  let currentAgentId: string | null = $state(null)
  let status = $state<ConnectionStatus>('ready')
  let messages: ChatMessage[] = $state([])
  let pendingFirstDelta = $state(false)
  let composerValue = $state('')
  let showTokenOverlay = $state(false)
  let authRequired = $state<boolean | null>(null)
  let sidebarOpen = $state(false)
  let chats: ChatSummary[] = $state([])
  let activeChatId: string | null = $state(null)
  let jumpToMessageId: number | null = $state(null)
  let currentChatIdsByAgent: Record<string, string | null> = $state({})
  let forwardModalOpen = $state(false)
  let forwardContent = $state('')
  let forwardFeedback: string | null = $state(null)
  let forwardFeedbackTone = $state<'error' | 'success'>('success')
  let forwardFeedbackTimeout = 0

  let activeAgent = $derived(
    agentItems.find((agent) => agent.id === currentAgentId) ?? null,
  )
  let isStreaming = $derived(status === 'streaming')
  let composerDisabled = $derived(!activeAgent || authRequired === null || (authRequired === true && !token))
  let composerPlaceholder = $derived(
    activeAgent ? `Message ${activeAgent.label}` : 'Send a message',
  )
  let canDismissTokenOverlay = $derived(Boolean(token))

  async function loadBridgeHealth() {
    try {
      const health = await getHealth()
      chat.setStatus(health.status === 'ok' ? 'ready' : 'error')
      authRequired = health.authRequired !== false
    } catch {
      authRequired = false
    }
  }

  async function refreshChats() {
    if (authRequired && !token) {
      chats = []
      return
    }

    try {
      chats = await fetchChats(token)
    } catch {
      chats = []
    }
  }

  async function handleSend(text: string, files: PendingFile[] = []) {
    if (!currentAgentId || (authRequired && !token)) {
      if (authRequired) showTokenOverlay = true
      return
    }

    composerValue = ''
    try {
      await chat.sendMessage(currentAgentId, text, token, files)
      await refreshChats()
    } catch {
      chat.setStatus('error')
    }
  }

  async function handleNewChat() {
    if (!currentAgentId || (authRequired && !token)) {
      if (authRequired) showTokenOverlay = true
      return
    }

    if (messages.length > 0 && !window.confirm('Start a new chat for this agent?')) {
      return
    }

    composerValue = ''
    await chat.clearAgent(currentAgentId, token)
    await refreshChats()

    if (window.innerWidth < 768) {
      sidebarOpen = false
    }
  }

  function handleSelectAgent(agentId: string) {
    composerValue = ''
    chat.setCurrentAgent(agentId)

    if (window.innerWidth < 768) {
      sidebarOpen = false
    }
  }

  async function handleSelectChat(chatId: string, messageId?: number) {
    if (authRequired && !token) {
      if (authRequired) showTokenOverlay = true
      return
    }

    try {
      await loadChatRequest(chatId, token)
      const detail = await fetchChat(chatId, token)
      if (!detail) {
        return
      }

      composerValue = ''
      chat.loadChatDetail(detail, messageId ?? null)
      jumpToMessageId = messageId ?? null

      if (window.innerWidth < 768) {
        sidebarOpen = false
      }
    } catch {
      chat.setStatus('error')
    }
  }

  async function handleDeleteChat(chatSummary: ChatSummary) {
    if (authRequired && !token) {
      if (authRequired) showTokenOverlay = true
      return
    }

    if (!window.confirm('Delete this chat?')) {
      return
    }

    const ok = await deleteChatRequest(chatSummary.id, token)
    if (!ok) {
      chat.setStatus('error')
      return
    }

    if (currentChatIdsByAgent[chatSummary.agent_id] === chatSummary.id) {
      chat.clearLoadedChat(chatSummary.agent_id)
    }

    if (activeChatId === chatSummary.id) {
      jumpToMessageId = null
    }

    await refreshChats()
  }

  function closeForwardModal() {
    forwardModalOpen = false
    forwardContent = ''
  }

  function showForwardStatus(message: string, tone: 'error' | 'success') {
    forwardFeedback = message
    forwardFeedbackTone = tone

    window.clearTimeout(forwardFeedbackTimeout)
    forwardFeedbackTimeout = window.setTimeout(() => {
      forwardFeedback = null
    }, 2200)
  }

  function handleForward(content: string) {
    if (!currentAgentId || !content.trim()) {
      return
    }

    forwardContent = content
    forwardModalOpen = true
  }

  async function handleForwardConfirm(targetAgentId: string) {
    if (!currentAgentId) {
      closeForwardModal()
      return
    }

    if (authRequired && !token) {
      closeForwardModal()
      if (authRequired) showTokenOverlay = true
      return
    }

    const content = forwardContent.trim()

    if (!content) {
      closeForwardModal()
      return
    }

    try {
      await forwardMessage(targetAgentId, content, currentAgentId, token)
      const targetLabel = agentItems.find((agent) => agent.id === targetAgentId)?.label ?? targetAgentId
      showForwardStatus(`Forwarded to ${targetLabel}`, 'success')
    } catch (error) {
      const message = error instanceof Error ? redactSensitiveAuth(error.message) : 'Unable to forward message'
      showForwardStatus(message, 'error')
    } finally {
      closeForwardModal()
    }
  }

  function handleTokenSave(value: string) {
    authToken.setToken(value)
    showTokenOverlay = false
  }

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen
  }

  $effect(() => {
    const unsubs = [
      agents.subscribe((value) => {
        agentItems = value.items
        agentError = value.error
        agentLoading = value.loading
      }),
      authToken.subscribe((value) => {
        token = value
      }),
      chat.subscribe((value) => {
        currentAgentId = value.currentAgentId
        status = value.status
        currentChatIdsByAgent = Object.fromEntries(
          Object.entries(value.sessions).map(([agentId, session]) => [agentId, session.currentChatId]),
        )
      }),
      currentSession.subscribe((value) => {
        messages = value.messages
        pendingFirstDelta = value.pendingFirstDelta
        activeChatId = value.currentChatId
        jumpToMessageId = value.targetMessageId
      }),
    ]

    return () => unsubs.forEach((unsubscribe) => unsubscribe())
  })

  $effect(() => {
    void loadBridgeHealth()
  })

  $effect(() => {
    if (authRequired === null) {
      return
    }

    if (authRequired && !token) {
      agents.clear()
      return
    }

    void agents.load(token || undefined)
      .then(() => {
        chat.setStatus('ready')
      })
      .catch(() => {})
  })

  $effect(() => {
    const ids = agentItems.map((agent) => agent.id)
    chat.syncAgents(ids)
  })

  $effect(() => {
    if (token) {
      void refreshChats()
    } else {
      chats = []
    }
  })

  $effect(() => {
    if (token && currentAgentId) {
      void chat.loadHistory(currentAgentId, token)
    }
  })

  $effect(() => {
    if (!token && authRequired) {
      showTokenOverlay = true
    }
  })
</script>

<svelte:head>
  <title>AskClaw IM</title>
</svelte:head>

<main class="app-shell">
  <Sidebar
    activeChatId={activeChatId}
    {chats}
    onClose={() => {
      sidebarOpen = false
    }}
    onDeleteChat={handleDeleteChat}
    onNewChat={handleNewChat}
    onSelectChat={handleSelectChat}
    open={sidebarOpen}
    {token}
  />

  <div class="app-main">
    <TabBar
      activeAgentId={currentAgentId ?? ''}
      agents={agentItems}
      hasMessages={messages.length > 0}
      onExportMarkdown={() => exportChatAsMarkdown(messages, activeAgent?.label ?? 'chat')}
      onExportText={() => exportChatAsText(messages, activeAgent?.label ?? 'chat')}
      onExportJson={() => exportChatAsJson(messages, activeAgent?.label ?? 'chat')}
      onNewChat={handleNewChat}
      onOpenTokenOverlay={() => {
        showTokenOverlay = true
      }}
      onSelectAgent={handleSelectAgent}
      onToggleSidebar={toggleSidebar}
      {status}
    />

    <ChatArea
      agentLabel={activeAgent?.label ?? 'Agent'}
      {isStreaming}
      {messages}
      onForward={handleForward}
      {pendingFirstDelta}
      targetMessageId={jumpToMessageId}
    />

    {#if forwardFeedback}
      <div class:error={forwardFeedbackTone === 'error'} class="forward-feedback" role="status">
        {forwardFeedback}
      </div>
    {/if}

    <Composer
      disabled={composerDisabled}
      {isStreaming}
      onStop={() => chat.abortStream()}
      onSubmit={handleSend}
      onUpdate={(value) => {
        composerValue = value
      }}
      placeholder={composerPlaceholder}
      value={composerValue}
    />
  </div>

  <TokenOverlay
    canDismiss={canDismissTokenOverlay}
    onCancel={() => {
      showTokenOverlay = false
    }}
    onSave={handleTokenSave}
    open={showTokenOverlay}
    value={token}
  />

  {#if currentAgentId}
    <ForwardModal
      agents={agentItems}
      currentAgentId={currentAgentId}
      onClose={closeForwardModal}
      onForward={handleForwardConfirm}
      open={forwardModalOpen}
    />
  {/if}
</main>

<style>
  .forward-feedback {
    position: fixed;
    left: 50%;
    bottom: 5.25rem;
    transform: translateX(-50%);
    padding: 0.7rem 0.95rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 14%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
    color: var(--text);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.12);
    z-index: 90;
  }

  .forward-feedback.error {
    background: color-mix(in srgb, #ef4444 12%, var(--surface));
    border-color: color-mix(in srgb, #ef4444 28%, var(--border));
  }
</style>
