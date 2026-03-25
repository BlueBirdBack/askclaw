import { describe, expect, it } from 'vitest'
import { formatForwardContext } from '../formatContext'

describe('formatForwardContext', () => {
  it('formats messages with context header and footer', () => {
    const result = formatForwardContext({
      messages: [
        { role: 'user', content: 'Build auth flow' },
        { role: 'assistant', content: 'Done. Added email_verify.py' },
        { role: 'user', content: 'Add rate limiting' },
        { role: 'assistant', content: 'Rate limiter added.' },
      ],
      fromAgentLabel: 'Six',
      forwardedContent: 'Please review this code.',
    })

    expect(result).toContain('--- Context from Six (4 messages) ---')
    expect(result).toContain('[user]: Build auth flow')
    expect(result).toContain('[assistant]: Done. Added email_verify.py')
    expect(result).toContain('[user]: Add rate limiting')
    expect(result).toContain('[assistant]: Rate limiter added.')
    expect(result).toContain('--- Forwarded message ---')
    expect(result).toContain('Please review this code.')
  })

  it('returns just the forwarded content when no messages exist', () => {
    const result = formatForwardContext({
      messages: [],
      fromAgentLabel: 'Six',
      forwardedContent: 'Review this.',
    })

    expect(result).toBe('Review this.')
    expect(result).not.toContain('Context from')
  })

  it('truncates to maxMessages (last N)', () => {
    const messages = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i + 1}`,
    }))

    const result = formatForwardContext({
      messages,
      fromAgentLabel: 'Six',
      forwardedContent: 'Forward this.',
      maxMessages: 20,
    })

    expect(result).toContain('(20 messages)')
    // Messages 1-5 should be dropped (only last 20 of 25 kept)
    expect(result).not.toContain('[user]: Message 1\n')
    expect(result).not.toContain('[assistant]: Message 4\n')
    expect(result).not.toContain('[user]: Message 5\n')
    // Messages 6-25 should be present
    expect(result).toContain('Message 6')
    expect(result).toContain('Message 25')
  })

  it('drops oldest messages when exceeding maxChars', () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({
      role: 'user',
      content: 'x'.repeat(1000),
    }))

    const result = formatForwardContext({
      messages,
      fromAgentLabel: 'Six',
      forwardedContent: 'Forward.',
      maxChars: 5000,
    })

    // Should have fewer than 10 messages due to char cap
    const messageCount = (result.match(/\[user\]:/g) || []).length
    expect(messageCount).toBeLessThan(10)
    expect(messageCount).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(5000)
  })

  it('returns just forwarded content if even one message exceeds maxChars', () => {
    const messages = [
      { role: 'user', content: 'x'.repeat(60000) },
    ]

    const result = formatForwardContext({
      messages,
      fromAgentLabel: 'Six',
      forwardedContent: 'Forward.',
      maxChars: 5000,
    })

    expect(result).toBe('Forward.')
  })

  it('strips nested forwarded-context blocks from messages', () => {
    const nestedContent =
      '--- Context from Six (3 messages) ---\n[user]: old msg\n[assistant]: old reply\n--- Forwarded message ---\nOriginal forward content\n\nAsh\'s actual review: looks good.'

    const result = formatForwardContext({
      messages: [
        { role: 'user', content: 'Review this code' },
        { role: 'assistant', content: nestedContent },
      ],
      fromAgentLabel: 'Ash',
      forwardedContent: 'Break-test this.',
    })

    expect(result).toContain('--- Context from Ash (2 messages) ---')
    // The nested context header should be stripped
    expect(result).not.toContain('Context from Six')
    // But Ash's actual review content should be preserved
    expect(result).toContain("Ash's actual review: looks good.")
  })

  it('preserves special characters and markdown in messages', () => {
    const result = formatForwardContext({
      messages: [
        { role: 'user', content: 'Fix the `auth/routes.py` file' },
        { role: 'assistant', content: '```python\ndef verify():\n    pass\n```' },
      ],
      fromAgentLabel: 'Six',
      forwardedContent: 'Check this **code**.',
    })

    expect(result).toContain('`auth/routes.py`')
    expect(result).toContain('```python')
    expect(result).toContain('**code**')
  })

  it('handles messages with only whitespace', () => {
    const result = formatForwardContext({
      messages: [
        { role: 'user', content: '   ' },
        { role: 'assistant', content: '\n\n' },
      ],
      fromAgentLabel: 'Six',
      forwardedContent: 'Forward.',
    })

    expect(result).toContain('--- Context from Six (2 messages) ---')
    expect(result).toContain('--- Forwarded message ---')
  })

  it('uses singular "message" for count of 1', () => {
    const result = formatForwardContext({
      messages: [{ role: 'user', content: 'hello' }],
      fromAgentLabel: 'Six',
      forwardedContent: 'Forward.',
    })

    expect(result).toContain('(1 message)')
    expect(result).not.toContain('(1 messages)')
  })
})
