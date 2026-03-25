const CONTEXT_HEADER_PATTERN = /^--- Context from .+ \(\d+ messages?\) ---[\s\S]*?--- Forwarded message ---\n/

export interface ForwardContext {
  messages: { role: string; content: string }[]
  fromAgentLabel: string
  forwardedContent: string
  maxMessages?: number
  maxChars?: number
}

/**
 * Formats conversation messages as context for forwarding to another agent.
 * Strips nested forwarded-context blocks to prevent exponential bloat on chained forwards.
 */
export function formatForwardContext(ctx: ForwardContext): string {
  const {
    messages,
    fromAgentLabel,
    forwardedContent,
    maxMessages = 20,
    maxChars = 50_000,
  } = ctx

  if (messages.length === 0) {
    return forwardedContent
  }

  // Take the last N messages
  const recent = messages.slice(-maxMessages)

  // Strip nested forwarded-context blocks and format each message
  const formatted = recent.map((m) => {
    const cleanContent = stripNestedContext(m.content)
    const label = m.role === 'user' ? 'user' : 'assistant'
    return `[${label}]: ${cleanContent}`
  })

  // Build the full context string, dropping oldest messages if over char limit
  const suffix = `\n--- Forwarded message ---\n${forwardedContent}`
  const header = `--- Context from ${fromAgentLabel} (${formatted.length} messages) ---\n`

  let body = formatted.join('\n')

  // Truncate from oldest messages if total exceeds maxChars
  let lines = [...formatted]
  while (header.length + body.length + suffix.length > maxChars && lines.length > 0) {
    lines.shift()
    body = lines.join('\n')
  }

  if (lines.length === 0) {
    return forwardedContent
  }

  const count = lines.length
  const adjustedHeader = `--- Context from ${fromAgentLabel} (${count} message${count === 1 ? '' : 's'}) ---\n`
  return adjustedHeader + body + suffix
}

function stripNestedContext(content: string): string {
  return content.replace(CONTEXT_HEADER_PATTERN, '').trim()
}
