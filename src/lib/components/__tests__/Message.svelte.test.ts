import { render, waitFor } from '@testing-library/svelte'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'
expect.extend(matchers)
import Message from '../Message.svelte'
import type { ChatMessage } from '../../stores/chat'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// authToken store — return empty string (no auth)
vi.mock('../../stores/auth', () => ({
  authToken: { subscribe: (fn: (v: string) => void) => { fn(''); return () => {} } },
}))

// fetch — simulate bridge file serve returning a blob
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeFakeBlob(type = 'image/jpeg') {
  return new Blob(['fake-image-bytes'], { type })
}

function stubFetchOk(type = 'image/jpeg') {
  mockFetch.mockResolvedValue({
    ok: true,
    blob: async () => makeFakeBlob(type),
  } as Response)
}

function stubFetchFail() {
  mockFetch.mockResolvedValue({ ok: false } as Response)
}

// URL.createObjectURL — return a fake blob URL
vi.stubGlobal('URL', {
  ...URL,
  createObjectURL: vi.fn(() => 'blob:fake-url'),
  revokeObjectURL: vi.fn(),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Hello',
    ts: Date.now(),
    persistedId: null,
    ...overrides,
  }
}

function makeImageAttachment(url = '/bridge/files/abc123') {
  return { name: 'photo.jpg', type: 'image/jpeg', url }
}

function makeFileAttachment(url = '/bridge/files/def456') {
  return { name: 'doc.pdf', type: 'application/pdf', url }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Message.svelte — image attachment rendering', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('renders <img> for image attachment after blob fetch succeeds', async () => {
    stubFetchOk('image/jpeg')

    const { container } = render(Message, {
      props: { message: makeMessage({ attachments: [makeImageAttachment()] }) },
    })

    await waitFor(() => {
      expect(container.querySelector('img.attachment-image')).not.toBeNull()
    })
    expect(container.querySelector('a.attachment-file')).toBeNull()
  })

  it('renders <img> for image attachment even when blob fetch fails (regression)', async () => {
    // This is the exact bug: old code required displayUrl !== url to show <img>
    // When fetch fails, displayUrl falls back to url → old condition was false → showed <a>
    stubFetchFail()

    const { container } = render(Message, {
      props: { message: makeMessage({ attachments: [makeImageAttachment()] }) },
    })

    // Even after fetch fails and displayUrl === url, it must still be an <img>
    await waitFor(() => {
      expect(container.querySelector('img.attachment-image')).not.toBeNull()
    }, { timeout: 2000 })
    expect(container.querySelector('a.attachment-file')).toBeNull()
  })

  it('renders <a> file link for non-image attachment', async () => {
    stubFetchOk('application/pdf')

    const { container } = render(Message, {
      props: { message: makeMessage({ attachments: [makeFileAttachment()] }) },
    })

    await waitFor(() => {
      expect(container.querySelector('a.attachment-file')).not.toBeNull()
    })
    expect(container.querySelector('img.attachment-image')).toBeNull()
  })

  it('renders both <img> and <a> for mixed attachments', async () => {
    stubFetchOk()

    const { container } = render(Message, {
      props: {
        message: makeMessage({
          attachments: [makeImageAttachment(), makeFileAttachment()],
        }),
      },
    })

    await waitFor(() => {
      expect(container.querySelector('img.attachment-image')).not.toBeNull()
      expect(container.querySelector('a.attachment-file')).not.toBeNull()
    })
  })

  it('renders no attachment elements when attachments is empty', () => {
    const { container } = render(Message, {
      props: { message: makeMessage({ attachments: [] }) },
    })

    expect(container.querySelector('img.attachment-image')).toBeNull()
    expect(container.querySelector('a.attachment-file')).toBeNull()
    expect(container.querySelector('.image-attachments')).toBeNull()
  })

  it('renders no attachment elements when attachments is undefined', () => {
    const { container } = render(Message, {
      props: { message: makeMessage() },
    })

    expect(container.querySelector('img.attachment-image')).toBeNull()
    expect(container.querySelector('.image-attachments')).toBeNull()
  })

  it('external image URL (not bridge-hosted) renders as <img> immediately', async () => {
    stubFetchOk()

    const externalAttachment = {
      name: 'external.jpg',
      type: 'image/jpeg',
      url: 'https://example.com/photo.jpg',
    }

    const { container } = render(Message, {
      props: { message: makeMessage({ attachments: [externalAttachment] }) },
    })

    await waitFor(() => {
      expect(container.querySelector('img.attachment-image')).not.toBeNull()
    })
  })
})

describe('Message.svelte — message content rendering', () => {
  it('renders user message content as plain text', () => {
    const { container } = render(Message, {
      props: { message: makeMessage({ role: 'user', content: 'Hello world' }) },
    })

    expect(container.textContent).toContain('Hello world')
  })

  it('renders assistant message with markdown', () => {
    const { container } = render(Message, {
      props: {
        message: makeMessage({
          role: 'assistant',
          content: '**bold** text',
        }),
      },
    })

    // Markdown renders <strong> for **bold**
    expect(container.querySelector('strong')).not.toBeNull()
  })

  it('shows pending typing indicator when pending=true and content is empty', () => {
    const { container } = render(Message, {
      props: {
        message: makeMessage({ role: 'assistant', content: '' }),
        pending: true,
      },
    })

    expect(container.querySelector('.typing-dots')).not.toBeNull()
  })

  it('does not show typing dots when content is present', () => {
    const { container } = render(Message, {
      props: {
        message: makeMessage({ role: 'assistant', content: 'Done.' }),
        pending: true,
      },
    })

    expect(container.querySelector('.typing-dots')).toBeNull()
  })
})
