import { describe, expect, it, vi, beforeEach } from 'vitest'
import { prepareMessagePayload } from '../chat'
import type { PendingFile } from '../../types'
import type { UploadedFile } from '../../api'

// ---------------------------------------------------------------------------
// jsdom polyfill — File.text() and File.arrayBuffer() are missing in jsdom
// ---------------------------------------------------------------------------

if (typeof File.prototype.text !== 'function') {
  File.prototype.text = function (): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsText(this)
    })
  }
}

if (typeof File.prototype.arrayBuffer !== 'function') {
  File.prototype.arrayBuffer = function (): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(this)
    })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePendingFile(
  name: string,
  type: string,
  content: string,
  isImage = false,
): PendingFile {
  const file = new File([content], name, { type })
  return {
    id: crypto.randomUUID(),
    file,
    previewUrl: isImage ? 'blob:fake' : '',
    isImage,
  }
}

function makeUploadedFile(overrides: Partial<UploadedFile> = {}): UploadedFile {
  return {
    id: 'upload-id-1',
    filename: 'test.jpg',
    content_type: 'image/jpeg',
    size: 1024,
    url: '/bridge/files/upload-id-1',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// prepareMessagePayload
// ---------------------------------------------------------------------------

describe('prepareMessagePayload', () => {
  it('text only — no files → correct displayText, empty files array', async () => {
    const result = await prepareMessagePayload('hello world', [], [])
    expect(result.displayText).toBe('hello world')
    expect(result.files).toEqual([])
    expect(result.attachments).toEqual([])
    expect(result.requestText).toBe('hello world')
  })

  it('text only — trims whitespace', async () => {
    const result = await prepareMessagePayload('  hi  ', [], [])
    expect(result.displayText).toBe('hi')
    expect(result.requestText).toBe('hi')
  })

  it('image file (jpeg) — base64 data in files array, no crash', async () => {
    // Use a minimal valid base64 JPEG-ish content
    const pending = makePendingFile('photo.jpg', 'image/jpeg', 'fake-image-data', true)
    const result = await prepareMessagePayload('describe this', [pending], [])

    expect(result.files).toHaveLength(1)
    expect(result.files[0].name).toBe('photo.jpg')
    expect(result.files[0].type).toBe('image/jpeg')
    expect(typeof result.files[0].data).toBe('string') // base64 string
    expect(result.files[0].data.length).toBeGreaterThan(0)
    expect(result.displayText).toContain('describe this')
  })

  it('image file — does not crash (the contentBlocks bug fix)', async () => {
    const pending = makePendingFile('img.png', 'image/png', 'pixels', true)
    // Should not throw ReferenceError: contentBlocks is not defined
    await expect(prepareMessagePayload('look', [pending], [])).resolves.toBeDefined()
  })

  it('text file (.txt) — content inlined in data field', async () => {
    const pending = makePendingFile('notes.txt', 'text/plain', 'hello from file')
    const result = await prepareMessagePayload('read this', [pending], [])

    expect(result.files).toHaveLength(1)
    expect(result.files[0].name).toBe('notes.txt')
    expect(result.files[0].data).toContain('hello from file')
    expect(result.displayText).toContain('notes.txt')
  })

  it('markdown file (.md) — treated as text, content inlined', async () => {
    const pending = makePendingFile('README.md', 'text/markdown', '# Title\nBody text')
    const result = await prepareMessagePayload('summarize', [pending], [])

    expect(result.files[0].data).toContain('# Title')
    expect(result.files[0].data).toContain('Body text')
  })

  it('binary/pdf file — fallback note in displayText, empty data string', async () => {
    const pending = makePendingFile('doc.pdf', 'application/pdf', '%PDF-1.4 binary')
    const result = await prepareMessagePayload('check this pdf', [pending], [])

    expect(result.files).toHaveLength(1)
    expect(result.files[0].name).toBe('doc.pdf')
    expect(result.files[0].data).toBe('')
    expect(result.displayText).toContain('doc.pdf')
    expect(result.displayText).toContain('application/pdf')
  })

  it('multiple mixed files — image + text file together', async () => {
    const img = makePendingFile('photo.jpg', 'image/jpeg', 'img-data', true)
    const txt = makePendingFile('notes.txt', 'text/plain', 'some notes')
    const result = await prepareMessagePayload('here are both', [img, txt], [])

    expect(result.files).toHaveLength(2)
    // image entry has base64 data
    const imgEntry = result.files.find((f) => f.name === 'photo.jpg')
    expect(imgEntry?.data.length).toBeGreaterThan(0)
    // text entry has inline content
    const txtEntry = result.files.find((f) => f.name === 'notes.txt')
    expect(txtEntry?.data).toContain('some notes')
  })

  it('empty text + image → fallback "What is in the attached image(s)?"', async () => {
    const pending = makePendingFile('img.jpg', 'image/jpeg', 'x', true)
    const result = await prepareMessagePayload('', [pending], [])

    expect(result.requestText).toBe('What is in the attached image(s)?')
    expect(result.displayText).toContain('What is in the attached image(s)?')
  })

  it('empty text + non-image → fallback "See the attached file(s)."', async () => {
    const pending = makePendingFile('data.csv', 'text/csv', 'a,b,c')
    const result = await prepareMessagePayload('', [pending], [])

    expect(result.requestText).toBe('See the attached file(s).')
    expect(result.displayText).toContain('See the attached file(s).')
  })

  it('uploadedFiles length mismatch → throws "Upload response mismatch"', async () => {
    const f1 = makePendingFile('a.txt', 'text/plain', 'aaa')
    const f2 = makePendingFile('b.txt', 'text/plain', 'bbb')
    const oneUpload = [makeUploadedFile()]

    // 2 pending, 1 uploaded → mismatch
    await expect(prepareMessagePayload('test', [f1, f2], oneUpload)).rejects.toThrow(
      'Upload response mismatch',
    )
  })

  it('uploadedFiles provided → MessageAttachment has url, name, type from uploadedFile', async () => {
    const pending = makePendingFile('shot.jpg', 'image/jpeg', 'data', true)
    const uploaded = makeUploadedFile({
      filename: 'shot.jpg',
      content_type: 'image/jpeg',
      url: '/bridge/files/abc123',
    })
    const result = await prepareMessagePayload('look', [pending], [uploaded])

    expect(result.attachments).toHaveLength(1)
    const att = result.attachments[0]
    expect(att.url).toBe('/bridge/files/abc123')
    expect(att.name).toBe('shot.jpg')
    expect(att.type).toBe('image/jpeg')
  })

  it('uploadedFiles=[] with pending files → no attachments built (upload not done)', async () => {
    const pending = makePendingFile('img.jpg', 'image/jpeg', 'x', true)
    const result = await prepareMessagePayload('hi', [pending], [])

    // No uploadedFiles means no attachments (upload wasn't performed)
    expect(result.attachments).toHaveLength(0)
    // But files array is still populated for the relay
    expect(result.files).toHaveLength(1)
  })

  it('whitespace-only text with image → uses fallback, not whitespace', async () => {
    const pending = makePendingFile('img.gif', 'image/gif', 'GIF89a', true)
    const result = await prepareMessagePayload('   ', [pending], [])

    expect(result.requestText).toBe('What is in the attached image(s)?')
  })
})
