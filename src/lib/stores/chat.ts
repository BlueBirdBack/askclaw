import { derived, get, writable } from 'svelte/store'

import { getHistory, newChat, streamSend, type BridgeMessage, type ChatDetail } from '../api'
import { redactSensitiveAuth } from './auth'
import type { BridgeSendFile, PendingFile } from '../types'

export interface ChatMessage {
  content: string
  id: string
  persistedId: number | null
  role: string
  ts: number
}

interface ChatSession {
  currentChatId: string | null
  error: string | null
  historyLoaded: boolean
  loadingHistory: boolean
  messages: ChatMessage[]
  pendingFirstDelta: boolean
  streamingMessageId: string | null
  targetMessageId: number | null
}

export type ConnectionStatus = 'ready' | 'streaming' | 'error'

interface ChatState {
  activeStreamAgentId: string | null
  currentAgentId: string | null
  sessions: Record<string, ChatSession>
  status: ConnectionStatus
}

type ContentBlock =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; source: { type: 'base64'; media_type: string; data: string } }

interface PreparedMessagePayload {
  displayText: string
  files: BridgeSendFile[]
  requestText: string
}

let messageSequence = 0
let activeController: AbortController | null = null

const FILE_MIME_BY_EXTENSION: Record<string, string> = {
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

const TEXT_MIME_TYPES = new Set([
  'application/ecmascript',
  'application/javascript',
  'application/json',
  'application/sql',
  'application/typescript',
  'application/x-javascript',
  'application/xml',
  'text/cache-manifest',
  'text/calendar',
  'text/css',
  'text/csv',
  'text/html',
  'text/javascript',
  'text/jsx',
  'text/markdown',
  'text/plain',
  'text/tsx',
  'text/xml',
])

const TEXT_FILE_EXTENSIONS = new Set([
  'c',
  'cfg',
  'cpp',
  'css',
  'csv',
  'go',
  'h',
  'html',
  'ini',
  'java',
  'js',
  'json',
  'log',
  'markdown',
  'md',
  'py',
  'rb',
  'rs',
  'sh',
  'sql',
  'text',
  'toml',
  'ts',
  'txt',
  'xml',
  'yaml',
  'yml',
])

function getFileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function normalizeFileType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') {
    return file.type
  }

  return FILE_MIME_BY_EXTENSION[getFileExtension(file.name)] ?? file.type ?? ''
}

function isTextLikeFile(file: File, normalizedType = normalizeFileType(file)): boolean {
  return normalizedType.startsWith('text/')
    || TEXT_MIME_TYPES.has(normalizedType)
    || TEXT_FILE_EXTENSIONS.has(getFileExtension(file.name))
}

function isImageFile(file: File, normalizedType = normalizeFileType(file)): boolean {
  return normalizedType.startsWith('image/')
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => {
      reject(reader.error ?? new Error(`Unable to read ${file.name}`))
    }

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error(`Unable to read ${file.name}`))
        return
      }

      resolve(reader.result)
    }

    reader.readAsDataURL(file)
  })
}

async function prepareMessagePayload(text: string, pendingFiles: PendingFile[] = []): Promise<PreparedMessagePayload> {
  const trimmed = text.trim()

  if (pendingFiles.length === 0) {
    return {
      displayText: trimmed,
      files: [],
      requestText: trimmed,
    }
  }

  await Promise.all(
    pendingFiles.map((pendingFile) => pendingFile.ready ?? Promise.resolve()),
  )

  const contentBlocks: ContentBlock[] = []
  const displaySections: string[] = []
  const files: BridgeSendFile[] = []

  for (const pendingFile of pendingFiles) {
    const file = pendingFile.file
    const type = normalizeFileType(file) || 'application/octet-stream'

    if (isTextLikeFile(file, type)) {
      const content = await file.text()
      const section = `--- ${file.name} ---\n${content}`

      contentBlocks.push({
        type: 'input_text',
        text: section,
      })
      displaySections.push(section)
      files.push({
        data: content,
        name: file.name,
        type,
      })
      continue
    }

    if (isImageFile(file, type)) {
      const dataUrl = await readFileAsDataUrl(file)
      const [, base64 = ''] = dataUrl.split(',', 2)

      contentBlocks.push({
        type: 'input_image',
        source: {
          data: base64,
          media_type: type,
          type: 'base64',
        },
      })
      displaySections.push(`[Image attached: ${file.name}]`)
      files.push({
        data: base64,
        name: file.name,
        type,
      })
      continue
    }

    const note = `[Attached file: ${file.name} (${type})]`

    contentBlocks.push({
      type: 'input_text',
      text: note,
    })
    displaySections.push(note)
    files.push({
      data: '',
      name: file.name,
      type,
    })
  }

  const hasImages = contentBlocks.some((block) => block.type === 'input_image')
  const fallbackPrompt = hasImages
    ? 'What is in the attached image(s)?'
    : 'See the attached file(s).'
  const userText = trimmed || fallbackPrompt

  contentBlocks.push({
    type: 'input_text',
    text: userText,
  })

  const displayText = [...displaySections, userText].filter(Boolean).join('\n\n')

  return {
    displayText,
    files,
    requestText: userText,
  }
}

function createSession(): ChatSession {
  return {
    currentChatId: null,
    error: null,
    historyLoaded: false,
    loadingHistory: false,
    messages: [],
    pendingFirstDelta: false,
    streamingMessageId: null,
    targetMessageId: null,
  }
}

function createMessage(
  role: string,
  content: string,
  ts = Date.now(),
  persistedId: number | null = null,
): ChatMessage {
  messageSequence += 1

  return {
    content,
    id: persistedId ? `persisted-${persistedId}` : `message-${ts}-${messageSequence}`,
    persistedId,
    role,
    ts,
  }
}

function ensureSession(state: ChatState, agentId: string): ChatSession {
  state.sessions[agentId] ??= createSession()
  return state.sessions[agentId]
}

function normalizeMessages(messages: BridgeMessage[]): ChatMessage[] {
  return messages.map((message) =>
    createMessage(
      message.role === 'model' ? 'assistant' : message.role,
      message.content ?? '',
      typeof message.ts === 'number'
        ? message.ts
        : typeof message.created_at === 'string'
          ? Date.parse(message.created_at)
          : Date.now(),
      typeof message.id === 'number' ? message.id : null,
    ),
  )
}

function normalizeDetailMessages(detail: ChatDetail): ChatMessage[] {
  return detail.messages.map((message) =>
    createMessage(
      message.role === 'model' ? 'assistant' : message.role,
      message.content ?? '',
      Date.parse(message.created_at),
      message.id,
    ),
  )
}

function removeStreamingPlaceholder(session: ChatSession) {
  if (!session.streamingMessageId) {
    return
  }

  const index = session.messages.findIndex((message) => message.id === session.streamingMessageId)
  if (index === -1) {
    return
  }

  if (!session.messages[index].content.trim()) {
    session.messages.splice(index, 1)
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return redactSensitiveAuth(error.message)
  }

  return 'Unknown error'
}

const state = writable<ChatState>({
  activeStreamAgentId: null,
  currentAgentId: null,
  sessions: {},
  status: 'ready',
})

function finishStream(agentId: string) {
  state.update((snapshot) => {
    const session = ensureSession(snapshot, agentId)

    removeStreamingPlaceholder(session)
    session.pendingFirstDelta = false
    session.streamingMessageId = null
    snapshot.activeStreamAgentId = null
    snapshot.status = 'ready'

    return { ...snapshot }
  })
}

export const currentSession = derived(state, ($state) => {
  if (!$state.currentAgentId) {
    return createSession()
  }

  return $state.sessions[$state.currentAgentId] ?? createSession()
})

export const chat = {
  abortStream() {
    activeController?.abort()
  },

  clearLoadedChat(agentId: string) {
    state.update((current) => {
      const session = ensureSession(current, agentId)
      session.currentChatId = null
      session.error = null
      session.historyLoaded = true
      session.loadingHistory = false
      session.messages = []
      session.pendingFirstDelta = false
      session.streamingMessageId = null
      session.targetMessageId = null
      return { ...current }
    })
  },

  async clearAgent(agentId: string, token: string) {
    const snapshot = get(state)

    if (snapshot?.activeStreamAgentId === agentId) {
      activeController?.abort()
    }

    const chatId = await newChat(agentId, token)

    state.update((current) => {
      const session = ensureSession(current, agentId)
      session.currentChatId = chatId
      session.error = null
      session.historyLoaded = true
      session.loadingHistory = false
      session.messages = []
      session.pendingFirstDelta = false
      session.streamingMessageId = null
      session.targetMessageId = null

      if (current.status !== 'streaming') {
        current.status = 'ready'
      }

      return { ...current }
    })
  },

  async loadHistory(agentId: string, token: string) {
    let shouldLoad = false

    state.update((current) => {
      const session = ensureSession(current, agentId)

      if (!session.historyLoaded && !session.loadingHistory) {
        session.error = null
        session.loadingHistory = true
        shouldLoad = true
      }

      return { ...current }
    })

    if (!shouldLoad) {
      return
    }

    try {
      const history = await getHistory(agentId, token)
      const messages = normalizeMessages(history.messages)

      state.update((current) => {
        const session = ensureSession(current, agentId)
        session.currentChatId = history.chatId
        session.error = null
        session.historyLoaded = true
        session.loadingHistory = false
        session.messages = messages
        session.targetMessageId = null

        if (current.status !== 'streaming') {
          current.status = 'ready'
        }

        return { ...current }
      })
    } catch (error) {
      state.update((current) => {
        const session = ensureSession(current, agentId)
        session.error = toErrorMessage(error)
        session.loadingHistory = false
        return { ...current }
      })
    }
  },

  loadChatDetail(detail: ChatDetail, targetMessageId: number | null = null) {
    state.update((current) => {
      const session = ensureSession(current, detail.agent_id)
      session.currentChatId = detail.id
      session.error = null
      session.historyLoaded = true
      session.loadingHistory = false
      session.messages = normalizeDetailMessages(detail)
      session.pendingFirstDelta = false
      session.streamingMessageId = null
      session.targetMessageId = targetMessageId
      current.currentAgentId = detail.agent_id

      if (current.status !== 'streaming') {
        current.status = 'ready'
      }

      return { ...current }
    })
  },

  async sendMessage(agentId: string, text: string, token: string, pendingFiles: PendingFile[] = []) {
    const trimmed = text.trim()

    if ((!trimmed && pendingFiles.length === 0) || activeController) {
      return
    }

    const payload = await prepareMessagePayload(text, pendingFiles)

    // Re-check after async file prep — another send may have started while we awaited
    if (activeController) {
      return
    }

    const controller = new AbortController()
    activeController = controller
    const assistantMessage = createMessage('assistant', '')

    state.update((current) => {
      const session = ensureSession(current, agentId)

      session.error = null
      session.historyLoaded = true
      session.messages = [
        ...session.messages,
        createMessage('user', payload.displayText),
        assistantMessage,
      ]
      session.pendingFirstDelta = true
      session.streamingMessageId = assistantMessage.id
      session.targetMessageId = null
      current.activeStreamAgentId = agentId
      current.status = 'streaming'

      return { ...current }
    })

    try {
      await streamSend({
        agent: agentId,
        onChatId: (chatId) => {
          state.update((current) => {
            const session = ensureSession(current, agentId)
            session.currentChatId = chatId
            return { ...current }
          })
        },
        files: payload.files,
        onDelta: (delta) => {
          state.update((current) => {
            const session = ensureSession(current, agentId)
            const streamingMessage = session.messages.find(
              (message) => message.id === session.streamingMessageId,
            )

            if (streamingMessage) {
              // Relay sends incremental chunks — accumulate, don't replace
              streamingMessage.content += delta
            }

            session.pendingFirstDelta = false
            return { ...current }
          })
        },
        signal: controller.signal,
        text: payload.requestText,
        token,
      })

      finishStream(agentId)
    } catch (error) {
      if (controller.signal.aborted) {
        finishStream(agentId)
        return
      }

      state.update((current) => {
        const session = ensureSession(current, agentId)
        removeStreamingPlaceholder(session)
        session.error = toErrorMessage(error)
        session.pendingFirstDelta = false
        session.streamingMessageId = null
        current.activeStreamAgentId = null
        current.status = 'ready'
        return { ...current }
      })
    } finally {
      if (activeController === controller) {
        activeController = null
      }
    }
  },

  setCurrentAgent(agentId: string) {
    state.update((current) => {
      ensureSession(current, agentId)
      current.currentAgentId = agentId
      return { ...current }
    })
  },

  setStatus(status: ConnectionStatus) {
    state.update((current) => {
      if (current.status === 'streaming' && status === 'ready') {
        return { ...current }
      }

      current.status = status
      return { ...current }
    })
  },

  subscribe: state.subscribe,

  syncAgents(agentIds: string[]) {
    state.update((current) => {
      for (const agentId of agentIds) {
        ensureSession(current, agentId)
      }

      if (!current.currentAgentId && agentIds.length > 0) {
        current.currentAgentId = agentIds[0]
      }

      return { ...current }
    })
  },
}
