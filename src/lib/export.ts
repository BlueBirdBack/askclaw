import type { ChatMessage } from './stores/chat'

function makeFilename(title: string, ext: string): string {
  const date = new Date().toISOString().slice(0, 10)
  const slug = title
    .trim()
    .slice(0, 20)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+$/, '')
  return slug ? `${slug}-${date}.${ext}` : `askclaw-chat-${date}.${ext}`
}

export function exportChatAsMarkdown(messages: ChatMessage[], title = ''): void {
  const parts: string[] = []

  for (const msg of messages) {
    const heading = msg.role === 'user' ? '## You' : '## Assistant'
    parts.push(`${heading}\n\n${msg.content}`)
  }

  const text = parts.join('\n\n---\n\n')
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = makeFilename(title, 'md')
  a.click()
  URL.revokeObjectURL(url)
}

export function exportChatAsText(messages: ChatMessage[], title = ''): void {
  const parts: string[] = []

  for (const msg of messages) {
    const label = msg.role === 'user' ? 'You' : 'Assistant'
    parts.push(`[${label}]\n${msg.content}`)
  }

  const text = parts.join('\n\n')
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = makeFilename(title, 'txt')
  a.click()
  URL.revokeObjectURL(url)
}

export function exportChatAsJson(messages: ChatMessage[], title = ''): void {
  const data = {
    title,
    exported: new Date().toISOString(),
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.ts,
    })),
  }

  const text = JSON.stringify(data, null, 2)
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = makeFilename(title, 'json')
  a.click()
  URL.revokeObjectURL(url)
}
