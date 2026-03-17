import type { BridgeSendFile } from './types'

export interface BridgeAgent {
  id: string
  label: string
  emoji?: string
}

export interface BridgeMessage {
  content: string
  created_at?: string
  id?: number
  role: string
  ts?: number
}

export interface ChatSummary {
  id: string
  agent_id: string
  title: string
  updated_at: string
}

export interface ChatDetail extends ChatSummary {
  created_at?: string
  messages: {
    content: string
    created_at: string
    id: number
    role: string
  }[]
}

export interface SearchResult {
  chat_id: string
  chat_title: string
  message_id: number
  role: string
  snippet: string
}

export interface HistoryResult {
  agentId: string
  chatId: string | null
  messages: BridgeMessage[]
  title: string
}

interface HistoryResponse {
  agent_id?: string
  chat_id?: string | null
  error?: string
  ok: boolean
  payload?: {
    messages?: BridgeMessage[]
  }
  title?: string
}

interface NewChatResponse {
  chatId?: string
  error?: string
  ok: boolean
}

interface ForwardResponse {
  msg_id?: string
  ok: boolean
}

export interface HealthResponse {
  status: string
  agents: BridgeAgent[]
  authRequired: boolean
  uptime: number
  ts: number
}

interface JsonRequestOptions {
  body?: unknown
  method?: 'DELETE' | 'GET' | 'POST'
  signal?: AbortSignal
  token?: string
}

interface StreamSendOptions {
  agent: string
  files?: BridgeSendFile[]
  onChatId?: (chatId: string) => void
  onDelta: (delta: string) => void
  signal?: AbortSignal
  text: string
  token: string
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
}

function withAuth(headers: HeadersInit, token?: string): HeadersInit {
  if (!token) {
    return headers
  }

  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  }
}

async function parseError(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const payload = (await response.json()) as { error?: string }
    return payload.error ?? `Request failed with status ${response.status}`
  }

  const text = (await response.text()).trim()
  return text || `Request failed with status ${response.status}`
}

async function requestJson<T>(path: string, options: JsonRequestOptions = {}): Promise<T> {
  const response = await fetch(path, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: withAuth(JSON_HEADERS, options.token),
    method: options.method ?? 'GET',
    signal: options.signal,
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return (await response.json()) as T
}

function parseSseEvent(chunk: string): string[] {
  const payloads: string[] = []

  for (const line of chunk.split('\n')) {
    if (!line.startsWith('data:')) {
      continue
    }

    payloads.push(line.slice(5).trim())
  }

  return payloads
}

export function getAgents(token?: string, signal?: AbortSignal): Promise<BridgeAgent[]> {
  return requestJson<BridgeAgent[]>('/bridge/agents', { signal, token })
}

export async function getHistory(
  agent: string,
  token: string,
  signal?: AbortSignal,
): Promise<HistoryResult> {
  const response = await requestJson<HistoryResponse>(
    `/bridge/history?agent=${encodeURIComponent(agent)}`,
    { signal, token },
  )

  if (!response.ok) {
    throw new Error(response.error ?? 'Unable to load history')
  }

  return {
    agentId: response.agent_id ?? agent,
    chatId: response.chat_id ?? null,
    messages: response.payload?.messages ?? [],
    title: response.title ?? '',
  }
}

export async function newChat(
  agent: string,
  token: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const response = await requestJson<NewChatResponse>('/bridge/new', {
    body: { agent },
    method: 'POST',
    signal,
    token,
  })

  if (!response.ok) {
    throw new Error(response.error ?? 'Unable to reset conversation')
  }

  return response.chatId ?? null
}

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return requestJson<HealthResponse>('/bridge/health', { signal })
}

export function fetchChats(token: string): Promise<ChatSummary[]> {
  return requestJson<ChatSummary[]>('/bridge/chats', { token })
}

export async function fetchChat(id: string, token: string): Promise<ChatDetail | null> {
  try {
    return await requestJson<ChatDetail>(`/bridge/chats/${encodeURIComponent(id)}`, { token })
  } catch {
    return null
  }
}

export async function deleteChat(id: string, token: string): Promise<boolean> {
  try {
    await requestJson<{ ok: boolean }>(`/bridge/chats/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      token,
    })
    return true
  } catch {
    return false
  }
}

export async function searchMessages(q: string, token: string): Promise<SearchResult[]> {
  if (!q.trim()) {
    return []
  }

  try {
    return await requestJson<SearchResult[]>(
      `/bridge/search?q=${encodeURIComponent(q)}`,
      { token },
    )
  } catch {
    return []
  }
}

export async function loadChat(id: string, token: string): Promise<void> {
  await requestJson<{ ok: boolean }>(`/bridge/chats/${encodeURIComponent(id)}/load`, {
    method: 'POST',
    token,
  })
}

export async function forwardMessage(
  targetAgent: string,
  text: string,
  fromAgent: string,
  token: string,
): Promise<ForwardResponse> {
  return requestJson<ForwardResponse>('/bridge/forward', {
    body: { agent: targetAgent, text, from_agent: fromAgent },
    method: 'POST',
    token,
  })
}

export async function streamSend(options: StreamSendOptions): Promise<void> {
  const response = await fetch('/bridge/send', {
    body: JSON.stringify({
      agent: options.agent,
      files: options.files,
      text: options.text,
    }),
    headers: withAuth(JSON_HEADERS, options.token),
    method: 'POST',
    signal: options.signal,
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  if (!response.body) {
    throw new Error('Missing response stream')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })

    let boundaryIndex = buffer.indexOf('\n\n')
    while (boundaryIndex !== -1) {
      const rawEvent = buffer.slice(0, boundaryIndex).replace(/\r/g, '')
      buffer = buffer.slice(boundaryIndex + 2)

      for (const payload of parseSseEvent(rawEvent)) {
        if (payload === '[DONE]') {
          return
        }

        const data = JSON.parse(payload) as { chatId?: string; delta?: string; error?: string }

        if (data.error) {
          throw new Error(data.error)
        }

        if (typeof data.chatId === 'string') {
          options.onChatId?.(data.chatId)
        }

        if (typeof data.delta === 'string') {
          options.onDelta(data.delta)
        }
      }

      boundaryIndex = buffer.indexOf('\n\n')
    }
  }

  buffer += decoder.decode()
  const trailingEvent = buffer.trim()

  if (!trailingEvent) {
    return
  }

  for (const payload of parseSseEvent(trailingEvent)) {
    if (payload === '[DONE]') {
      return
    }

    const data = JSON.parse(payload) as { chatId?: string; delta?: string; error?: string }

    if (data.error) {
      throw new Error(data.error)
    }

    if (typeof data.chatId === 'string') {
      options.onChatId?.(data.chatId)
    }

    if (typeof data.delta === 'string') {
      options.onDelta(data.delta)
    }
  }
}
