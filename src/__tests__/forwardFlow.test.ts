import { describe, expect, it, vi } from 'vitest'
import { formatForwardContext } from '../lib/formatContext'

/**
 * Integration tests for the forward-with-context flow.
 * Tests the logic that handleForwardConfirm() orchestrates:
 * context collection → formatting → agent switch → send.
 */
describe('forward flow integration', () => {
  it('collects messages from current session and formats with context', () => {
    // Simulate what handleForwardConfirm does
    const sessionMessages = [
      { role: 'user', content: 'Build auth flow with email verification' },
      { role: 'assistant', content: 'Done. Added auth/email_verify.py with token generation.' },
      { role: 'user', content: 'Add rate limiting too' },
      { role: 'assistant', content: 'Rate limiter added using Redis backend.' },
    ]

    const forwardedContent = 'Rate limiter added using Redis backend.'
    const formattedText = formatForwardContext({
      messages: sessionMessages.map((m) => ({ role: m.role, content: m.content })),
      fromAgentLabel: 'Six',
      forwardedContent,
    })

    // The formatted text should be ready to send to the target agent
    expect(formattedText).toContain('--- Context from Six (4 messages) ---')
    expect(formattedText).toContain('Build auth flow')
    expect(formattedText).toContain('--- Forwarded message ---')
    expect(formattedText).toContain('Rate limiter added using Redis backend.')
  })

  it('handles chained forwards without context bloat', () => {
    // Simulate: Six builds → forward to Ash → Ash reviews → forward to Glitch
    // Ash's session contains the forwarded message with Six's context
    const ashMessages = [
      {
        role: 'user',
        content:
          '--- Context from Six (2 messages) ---\n' +
          '[user]: Build auth\n' +
          '[assistant]: Done.\n' +
          '--- Forwarded message ---\n' +
          'Done. Built auth flow.',
      },
      {
        role: 'assistant',
        content: 'Code review: Two issues found. Token expiry is hardcoded.',
      },
    ]

    const formattedForGlitch = formatForwardContext({
      messages: ashMessages.map((m) => ({ role: m.role, content: m.content })),
      fromAgentLabel: 'Ash',
      forwardedContent: 'Code review: Two issues found. Token expiry is hardcoded.',
    })

    // Should NOT contain nested "Context from Six" — that should be stripped
    expect(formattedForGlitch).toContain('--- Context from Ash')
    expect(formattedForGlitch).not.toContain('Context from Six')
    // Ash's actual review should be preserved
    expect(formattedForGlitch).toContain('Two issues found')
  })

  it('produces empty-context output for first message in a session', () => {
    // First interaction — no prior messages to forward context from
    const result = formatForwardContext({
      messages: [],
      fromAgentLabel: 'Six',
      forwardedContent: 'Hello, please review.',
    })

    expect(result).toBe('Hello, please review.')
  })

  it('handles the full Six→Ash→Glitch pipeline', () => {
    // Step 1: Six builds
    const sixMessages = [
      { role: 'user', content: 'Build a user auth flow' },
      { role: 'assistant', content: 'Added auth/email_verify.py. 47 lines across 3 files.' },
    ]

    // Step 2: Forward Six's output to Ash
    const forwardToAsh = formatForwardContext({
      messages: sixMessages.map((m) => ({ role: m.role, content: m.content })),
      fromAgentLabel: 'Six',
      forwardedContent: 'Added auth/email_verify.py. 47 lines across 3 files.',
    })

    expect(forwardToAsh).toContain('Context from Six (2 messages)')

    // Step 3: Ash reviews (simulated — Ash's session now contains the forward)
    const ashMessages = [
      { role: 'user', content: forwardToAsh },
      { role: 'assistant', content: 'Review: Token expiry hardcoded. Rate limiter uses in-memory dict.' },
    ]

    // Step 4: Forward Ash's review to Glitch
    const forwardToGlitch = formatForwardContext({
      messages: ashMessages.map((m) => ({ role: m.role, content: m.content })),
      fromAgentLabel: 'Ash',
      forwardedContent: 'Review: Token expiry hardcoded. Rate limiter uses in-memory dict.',
    })

    // Verify no nested context bloat
    expect(forwardToGlitch).toContain('Context from Ash (2 messages)')
    expect(forwardToGlitch).not.toContain('Context from Six')
    // But Ash's review content is there
    expect(forwardToGlitch).toContain('Token expiry hardcoded')
    expect(forwardToGlitch).toContain('--- Forwarded message ---')
  })

  it('blocks double-send via activeController pattern', () => {
    // Simulate the activeController guard from chat.sendMessage
    let activeController: AbortController | null = null

    function sendMessage(text: string): boolean {
      if (activeController) return false // blocked
      activeController = new AbortController()
      // Simulate async work
      return true
    }

    // First send succeeds
    expect(sendMessage('first')).toBe(true)
    // Second send is blocked while first is active
    expect(sendMessage('second')).toBe(false)

    // After first completes
    activeController = null
    expect(sendMessage('third')).toBe(true)
  })
})
