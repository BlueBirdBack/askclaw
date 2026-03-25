<script lang="ts">
  import { get } from 'svelte/store'

  import { tick } from 'svelte'

  import {
    deleteChat as deleteChatRequest,
    fetchChat,
    fetchChats,
    getHealth,
    loadChat as loadChatRequest,
    type ChatSummary,
  } from './lib/api'
  import { formatForwardContext } from './lib/formatContext'
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
  // On desktop (>=768px) sidebar is always open in the 2-column grid layout
  let sidebarOpen = $state(typeof window !== 'undefined' ? window.innerWidth >= 768 : false)
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
    try {
      await chat.clearAgent(currentAgentId, token)
      await refreshChats()
    } catch {
      chat.setStatus('error')
    }

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

    // Collect context from current agent's session
    const chatState = get(chat)
    const currentSession = chatState.sessions[currentAgentId]
    const sessionMessages = currentSession?.messages ?? []
    const fromLabel = agentItems.find((a) => a.id === currentAgentId)?.label ?? currentAgentId

    const formattedText = formatForwardContext({
      messages: sessionMessages.map((m) => ({ role: m.role, content: m.content })),
      fromAgentLabel: fromLabel,
      forwardedContent: content,
    })

    const targetLabel = agentItems.find((agent) => agent.id === targetAgentId)?.label ?? targetAgentId
    closeForwardModal()

    // Switch to target agent and wait for Svelte reactivity to settle
    chat.setCurrentAgent(targetAgentId)
    await tick()

    // Send the context-enriched message via existing flow
    chat.sendMessage(targetAgentId, formattedText, token)
    showForwardStatus(`Forwarded to ${targetLabel}`, 'success')
  }

  function handleTokenSave(value: string) {
    authToken.setToken(value)
    showTokenOverlay = false
  }

  function handleTokenClear() {
    authToken.clearToken()
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
      .catch(() => {
        // Error surfaced via status='error' → StatusDot in TabBar turns red
        // agentError string is tracked but not rendered as text (accepted limitation)
        chat.setStatus('error')
      })
  })

  $effect(() => {
    const ids = agentItems.map((agent) => agent.id)
    chat.syncAgents(ids)
  })

  $effect(() => {
    const authOk = authRequired === false || (authRequired === true && Boolean(token))
    if (authOk) {
      void refreshChats()
    } else {
      chats = []
    }
  })

  $effect(() => {
    // Load history when we have an agent selected and auth is resolved.
    // In trusted mode (authRequired=false), no token is needed — load immediately.
    const authOk = authRequired === false || (authRequired === true && Boolean(token))
    if (authOk && currentAgentId) {
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
    onClear={handleTokenClear}
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
