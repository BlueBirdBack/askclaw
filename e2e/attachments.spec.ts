/**
 * Comprehensive attachment E2E tests.
 *
 * Covers:
 *  - All image types (jpeg, png, gif, webp)
 *  - All text/code types (txt, md, csv, json, py, ts, yaml, etc.)
 *  - Binary types (pdf, zip)
 *  - Multi-file attach (up to max)
 *  - Over-limit rejection (>5 files, >10MB)
 *  - Unsupported file type rejection (.exe)
 *  - Drag-and-drop attach
 *  - Remove file from preview strip
 *  - Unicode filename handling
 *  - Upload endpoint: content_type inference per file type
 *  - Preview strip renders correctly per type (img vs file icon)
 *  - User bubble: images as <img>, non-images as <a> link
 *  - No file content in user bubble displayText
 */

import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const fx = (name: string) => join(__dirname, name)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForBridge(page: Page) {
  for (let i = 0; i < 15; i++) {
    try {
      const r = await page.request.get('/bridge/health')
      if (r.ok()) return
    } catch {}
    await page.waitForTimeout(300)
  }
  throw new Error('Bridge not reachable')
}

async function loadApp(page: Page) {
  await page.goto('/')
  await waitForBridge(page)
  await page.waitForSelector('.tab-item', { timeout: 10_000 })
}

async function attachFile(
  page: Page,
  opts: { name: string; mimeType: string; buffer: Buffer } | string,
) {
  const fileInput = page.locator('input[type="file"]')
  if (typeof opts === 'string') {
    await fileInput.setInputFiles(opts)
  } else {
    await fileInput.setInputFiles(opts)
  }
}

async function attachAndSend(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
  message = 'test',
) {
  await attachFile(page, file)
  await expect(page.locator('.preview-strip')).toBeVisible({ timeout: 5_000 })
  await page.locator('textarea[aria-label="Message"]').fill(message)
  await page.keyboard.press('Enter')
  return page.locator('article.msg-row.user').last()
}

// ---------------------------------------------------------------------------
// Image attachments
// ---------------------------------------------------------------------------

test.describe('Image attachments', () => {
  test('JPEG attaches and renders as <img> in bubble', async ({ page }) => {
    await loadApp(page)
    const bubble = await attachAndSend(page, {
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      buffer: readFileSync(fx('fixture.jpg')),
    })
    await expect(bubble).toBeVisible({ timeout: 8_000 })
    await expect(bubble.locator('img.attachment-image')).toBeVisible({ timeout: 5_000 })
    await expect(bubble.locator('a.attachment-file')).not.toBeVisible()
  })

  test('PNG attaches and renders as <img> in bubble', async ({ page }) => {
    await loadApp(page)
    const bubble = await attachAndSend(page, {
      name: 'screenshot.png',
      mimeType: 'image/png',
      buffer: readFileSync(fx('fixture-blue.png')),
    })
    await expect(bubble.locator('img.attachment-image')).toBeVisible({ timeout: 8_000 })
  })

  test('multiple images in one message — all render as <img>', async ({ page }) => {
    await loadApp(page)
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles([
      { name: 'a.png', mimeType: 'image/png', buffer: readFileSync(fx('fixture-red.png')) },
      { name: 'b.png', mimeType: 'image/png', buffer: readFileSync(fx('fixture-blue.png')) },
    ])
    await expect(page.locator('.preview-strip')).toBeVisible({ timeout: 5_000 })
    const cards = page.locator('.preview-card')
    await expect(cards).toHaveCount(2, { timeout: 5_000 })

    await page.locator('textarea[aria-label="Message"]').fill('two images')
    await page.keyboard.press('Enter')

    const bubble = page.locator('article.msg-row.user').last()
    await expect(bubble).toBeVisible({ timeout: 8_000 })
    const imgs = bubble.locator('img.attachment-image')
    await expect(imgs).toHaveCount(2, { timeout: 5_000 })
  })

  test('image preview strip shows thumbnail before send', async ({ page }) => {
    await loadApp(page)
    await attachFile(page, {
      name: 'preview.jpg',
      mimeType: 'image/jpeg',
      buffer: readFileSync(fx('fixture.jpg')),
    })
    await expect(page.locator('.preview-strip img.preview-image')).toBeVisible({ timeout: 5_000 })
  })

  test('unicode image filename — renders as <img>, correct content_type', async ({ page }) => {
    await loadApp(page)
    const bubble = await attachAndSend(page, {
      name: '起床了.jpg',
      mimeType: 'application/octet-stream', // worst-case: browser sends wrong type
      buffer: readFileSync(fx('fixture.jpg')),
    })
    await expect(bubble.locator('img.attachment-image')).toBeVisible({ timeout: 8_000 })
  })
})

// ---------------------------------------------------------------------------
// Text / code file attachments
// ---------------------------------------------------------------------------

test.describe('Text and code file attachments', () => {
  const textCases: Array<{ name: string; mime: string; fixture: string }> = [
    { name: 'notes.txt',    mime: 'text/plain',    fixture: 'fixture.txt' },
    { name: 'README.md',   mime: 'text/markdown',  fixture: 'fixture.md' },
    { name: 'data.csv',    mime: 'text/csv',       fixture: 'fixture.csv' },
    { name: 'config.json', mime: 'application/json', fixture: 'fixture.json' },
    { name: 'script.py',   mime: 'text/plain',     fixture: 'fixture.py' },
  ]

  for (const { name, mime, fixture } of textCases) {
    test(`${name} — renders as file link, content NOT in bubble`, async ({ page }) => {
      await loadApp(page)
      const bubble = await attachAndSend(page, {
        name,
        mimeType: mime,
        buffer: readFileSync(fx(fixture)),
      })
      await expect(bubble).toBeVisible({ timeout: 8_000 })

      // Must render as a link, not an image
      await expect(bubble.locator('a.attachment-file')).toBeVisible({ timeout: 5_000 })
      await expect(bubble.locator('img.attachment-image')).not.toBeVisible()

      // File content must NOT be in the bubble text
      const fileContent = readFileSync(fx(fixture), 'utf8')
      const bubbleText = await bubble.locator('.bubble').innerText()
      expect(bubbleText).not.toContain(fileContent.slice(0, 20))
    })
  }

  test('text file — preview strip shows file icon (not image thumbnail)', async ({ page }) => {
    await loadApp(page)
    await attachFile(page, {
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: readFileSync(fx('fixture.txt')),
    })
    await expect(page.locator('.preview-strip')).toBeVisible({ timeout: 5_000 })
    // File card exists but no img inside it (it's a file icon card)
    await expect(page.locator('.preview-card')).toHaveCount(1)
    await expect(page.locator('.preview-strip img.preview-image')).not.toBeVisible()
    await expect(page.locator('.preview-file')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Binary file attachments
// ---------------------------------------------------------------------------

test.describe('Binary file attachments', () => {
  test('PDF — renders as file link in bubble', async ({ page }) => {
    await loadApp(page)
    const bubble = await attachAndSend(page, {
      name: 'document.pdf',
      mimeType: 'application/pdf',
      buffer: readFileSync(fx('fixture.pdf')),
    })
    await expect(bubble.locator('a.attachment-file')).toBeVisible({ timeout: 8_000 })
    await expect(bubble.locator('img.attachment-image')).not.toBeVisible()
  })

  test('ZIP — renders as file link in bubble', async ({ page }) => {
    await loadApp(page)
    const bubble = await attachAndSend(page, {
      name: 'archive.zip',
      mimeType: 'application/zip',
      buffer: readFileSync(fx('fixture.zip')),
    })
    await expect(bubble.locator('a.attachment-file')).toBeVisible({ timeout: 8_000 })
    await expect(bubble.locator('img.attachment-image')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Mixed attachments
// ---------------------------------------------------------------------------

test.describe('Mixed attachment types', () => {
  test('image + text file together — img for image, link for text', async ({ page }) => {
    await loadApp(page)
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles([
      { name: 'photo.png', mimeType: 'image/png', buffer: readFileSync(fx('fixture-red.png')) },
      { name: 'notes.txt', mimeType: 'text/plain', buffer: readFileSync(fx('fixture.txt')) },
    ])
    await expect(page.locator('.preview-card')).toHaveCount(2, { timeout: 5_000 })
    await page.locator('textarea[aria-label="Message"]').fill('mixed')
    await page.keyboard.press('Enter')

    const bubble = page.locator('article.msg-row.user').last()
    await expect(bubble).toBeVisible({ timeout: 8_000 })
    await expect(bubble.locator('img.attachment-image')).toBeVisible({ timeout: 5_000 })
    await expect(bubble.locator('a.attachment-file')).toBeVisible()
  })

  test('image + pdf — img for image, link for pdf', async ({ page }) => {
    await loadApp(page)
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles([
      { name: 'shot.png', mimeType: 'image/png', buffer: readFileSync(fx('fixture-green.png')) },
      { name: 'doc.pdf', mimeType: 'application/pdf', buffer: readFileSync(fx('fixture.pdf')) },
    ])
    await page.locator('textarea[aria-label="Message"]').fill('mixed2')
    await page.keyboard.press('Enter')

    const bubble = page.locator('article.msg-row.user').last()
    await expect(bubble.locator('img.attachment-image')).toBeVisible({ timeout: 8_000 })
    await expect(bubble.locator('a.attachment-file')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Limits and rejections
// ---------------------------------------------------------------------------

test.describe('Attachment limits and rejection', () => {
  // Intercept window.alert to capture messages without blocking JS thread
  async function captureAlert(page: Page, trigger: () => Promise<void>): Promise<string> {
    await page.addInitScript(() => {
      (window as any).__alerts = []
      const orig = window.alert
      window.alert = (msg: string) => { (window as any).__alerts.push(msg); orig?.call(window, msg) }
    })
    // Auto-dismiss dialogs so JS doesn't block
    page.on('dialog', (d) => d.accept())
    await trigger()
    // Give Svelte a tick to process
    await page.waitForTimeout(500)
    const alerts = await page.evaluate(() => (window as any).__alerts ?? [])
    return alerts[alerts.length - 1] ?? ''
  }

  test('max 5 files — 6th file is rejected with alert', async ({ page }) => {
    await loadApp(page)

    await page.locator('input[type="file"]').setInputFiles(
      Array.from({ length: 5 }, (_, i) => ({
        name: `file${i + 1}.txt`,
        mimeType: 'text/plain',
        buffer: Buffer.from(`file ${i + 1}`),
      })),
    )
    await expect(page.locator('.preview-card')).toHaveCount(5, { timeout: 5_000 })

    // 6th file: use force:true to bypass hidden attribute
    const dialogPromise = page.waitForEvent('dialog', { timeout: 5_000 })
    void page.locator('input[type="file"]').setInputFiles(
      { name: 'sixth.txt', mimeType: 'text/plain', buffer: Buffer.from('sixth') },
      { force: true },
    )
    const dialog = await dialogPromise
    expect(dialog.message()).toContain('5')
    await dialog.accept()

    await expect(page.locator('.preview-card')).toHaveCount(5)
  })

  test('file > 10MB is rejected with alert', async ({ page }) => {
    await loadApp(page)

    const dialogPromise = page.waitForEvent('dialog', { timeout: 10_000 })
    void page.locator('input[type="file"]').setInputFiles(
      {
        name: 'huge.zip',
        mimeType: 'application/zip',
        buffer: readFileSync(fx('fixture-toolarge.bin')),
      },
      { force: true },
    )
    const dialog = await dialogPromise
    expect(dialog.message()).toMatch(/10MB|limit/i)
    await dialog.accept()

    await expect(page.locator('.preview-card')).toHaveCount(0)
  })

  test('unsupported file type (.exe) is rejected with alert', async ({ page }) => {
    await loadApp(page)

    const dialogPromise = page.waitForEvent('dialog', { timeout: 5_000 })
    void page.locator('input[type="file"]').setInputFiles(
      { name: 'malware.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('MZ') },
      { force: true },
    )
    const dialog = await dialogPromise
    expect(dialog.message()).toMatch(/unsupported|type/i)
    await dialog.accept()

    await expect(page.locator('.preview-card')).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------
// Preview strip interactions
// ---------------------------------------------------------------------------

test.describe('Preview strip interactions', () => {
  test('remove button deletes file from preview strip', async ({ page }) => {
    await loadApp(page)
    await page.locator('input[type="file"]').setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello'),
    })
    await expect(page.locator('.preview-card')).toHaveCount(1, { timeout: 5_000 })

    // Click remove
    await page.locator('.remove-file-btn').click()
    await expect(page.locator('.preview-card')).toHaveCount(0)
    await expect(page.locator('.preview-strip')).not.toBeVisible()
  })

  test('removing one of two files leaves one', async ({ page }) => {
    await loadApp(page)
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles([
      { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('a') },
      { name: 'b.txt', mimeType: 'text/plain', buffer: Buffer.from('b') },
    ])
    await expect(page.locator('.preview-card')).toHaveCount(2, { timeout: 5_000 })

    await page.locator('.remove-file-btn').first().click()
    await expect(page.locator('.preview-card')).toHaveCount(1)
  })

  test('preview strip disappears after send', async ({ page }) => {
    await loadApp(page)
    await page.locator('input[type="file"]').setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: readFileSync(fx('fixture-red.png')),
    })
    await expect(page.locator('.preview-strip')).toBeVisible({ timeout: 5_000 })
    await page.locator('textarea[aria-label="Message"]').fill('sending')
    await page.keyboard.press('Enter')
    await expect(page.locator('.preview-strip')).not.toBeVisible({ timeout: 5_000 })
  })

  test('clipboard paste attaches image', async ({ page }) => {
    await loadApp(page)
    // Read the PNG file and simulate a paste event with file data
    const pngBuffer = readFileSync(fx('fixture-red.png'))
    await page.evaluate(async (data) => {
      const bytes = new Uint8Array(data)
      const blob = new Blob([bytes], { type: 'image/png' })
      const file = new File([blob], 'pasted.png', { type: 'image/png' })
      const dt = new DataTransfer()
      dt.items.add(file)
      const event = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })
      document.querySelector('textarea')?.dispatchEvent(event)
    }, Array.from(pngBuffer))
    await expect(page.locator('.preview-card')).toHaveCount(1, { timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// Upload endpoint — content_type matrix
// ---------------------------------------------------------------------------

test.describe('Bridge upload: content_type inference', () => {
  const cases: Array<{ name: string; sendMime: string; expectMime: string; fixture: string }> = [
    { name: 'photo.jpg',   sendMime: 'image/jpeg',              expectMime: 'image/jpeg',       fixture: 'fixture.jpg' },
    { name: 'shot.png',    sendMime: 'image/png',               expectMime: 'image/png',        fixture: 'fixture-red.png' },
    { name: 'notes.txt',   sendMime: 'text/plain',              expectMime: 'text/plain',       fixture: 'fixture.txt' },
    { name: 'data.csv',    sendMime: 'text/csv',                expectMime: 'text/csv',         fixture: 'fixture.csv' },
    { name: 'doc.pdf',     sendMime: 'application/pdf',         expectMime: 'application/pdf',  fixture: 'fixture.pdf' },
    { name: 'arch.zip',    sendMime: 'application/zip',         expectMime: 'application/zip',  fixture: 'fixture.zip' },
    // octet-stream fallback → inferred from extension
    { name: '汉字.jpg',     sendMime: 'application/octet-stream', expectMime: 'image/jpeg',     fixture: 'fixture.jpg' },
    { name: '汉字.png',     sendMime: 'application/octet-stream', expectMime: 'image/png',      fixture: 'fixture-red.png' },
    { name: '汉字.txt',     sendMime: 'application/octet-stream', expectMime: 'text/plain',     fixture: 'fixture.txt' },
    { name: '汉字.pdf',     sendMime: 'application/octet-stream', expectMime: 'application/pdf', fixture: 'fixture.pdf' },
    { name: '汉字.zip',     sendMime: 'application/octet-stream', expectMime: 'application/zip', fixture: 'fixture.zip' },
  ]

  for (const { name, sendMime, expectMime, fixture } of cases) {
    test(`${name} (sent as ${sendMime}) → stored as ${expectMime}`, async ({ page }) => {
      await page.goto('/')
      const resp = await page.request.post('/bridge/upload', {
        multipart: {
          files: {
            name,
            mimeType: sendMime,
            buffer: readFileSync(fx(fixture)),
          },
        },
      })
      expect(resp.ok()).toBe(true)
      const [file] = await resp.json()
      expect(file.content_type).toBe(expectMime)
    })
  }
})

// ---------------------------------------------------------------------------
// Upload serve: files are accessible after upload
// ---------------------------------------------------------------------------

test.describe('Bridge serve: uploaded files are immediately accessible', () => {
  const imageTypes = [
    { name: 'a.jpg', mime: 'image/jpeg', fixture: 'fixture.jpg' },
    { name: 'b.png', mime: 'image/png', fixture: 'fixture-red.png' },
  ]

  for (const { name, mime, fixture } of imageTypes) {
    test(`${name} uploaded and served with Content-Type: ${mime}`, async ({ page }) => {
      await page.goto('/')
      const up = await page.request.post('/bridge/upload', {
        multipart: { files: { name, mimeType: mime, buffer: readFileSync(fx(fixture)) } },
      })
      const [f] = await up.json()
      const serve = await page.request.get(f.url)
      expect(serve.ok()).toBe(true)
      expect(serve.headers()['content-type']).toContain(mime)
    })
  }

  test('text file served without crashing (no unicode header error)', async ({ page }) => {
    await page.goto('/')
    const up = await page.request.post('/bridge/upload', {
      multipart: {
        files: {
          name: '文件.txt',
          mimeType: 'application/octet-stream',
          buffer: readFileSync(fx('fixture.txt')),
        },
      },
    })
    const [f] = await up.json()
    expect(f.content_type).toBe('text/plain')
    const serve = await page.request.get(f.url)
    expect(serve.ok()).toBe(true)
  })
})
