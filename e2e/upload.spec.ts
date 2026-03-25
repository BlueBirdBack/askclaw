import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const FIXTURE_IMAGE = join(__dirname, 'fixture-red.png')

/** Wait for the bridge health endpoint to be reachable */
async function waitForBridge(page: Page, retries = 10) {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await page.request.get('/bridge/health')
      if (resp.ok()) return
    } catch {}
    await page.waitForTimeout(300)
  }
  throw new Error('Bridge not reachable')
}

/** Load the app and wait for it to be ready (agents loaded) */
async function loadApp(page: Page) {
  await page.goto('/')
  await waitForBridge(page)
  // Wait for at least one agent tab to appear (agents.json loaded)
  await page.waitForSelector('.tab-item', { timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// Upload → display E2E tests
// ---------------------------------------------------------------------------

test.describe('Image upload → display', () => {
  test('image attaches as thumbnail preview before send', async ({ page }) => {
    await loadApp(page)

    // Attach image via file input
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(FIXTURE_IMAGE)

    // Preview strip should appear with an <img> thumbnail
    await expect(page.locator('.preview-strip')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('.preview-strip img.preview-image')).toBeVisible()
  })

  test('image uploads and renders as <img> in message bubble after send', async ({ page }) => {
    await loadApp(page)

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(FIXTURE_IMAGE)

    // Wait for preview to confirm file is staged
    await expect(page.locator('.preview-strip')).toBeVisible({ timeout: 5_000 })

    // Type a message and send
    const textarea = page.locator('textarea[aria-label="Message"]')
    await textarea.fill('what colour is this?')
    await page.keyboard.press('Enter')

    // User bubble should appear — wait for it
    const userBubble = page.locator('article.msg-row.user').last()
    await expect(userBubble).toBeVisible({ timeout: 8_000 })

    // The image must render as <img>, NOT as an <a> link (the regression we fixed)
    await expect(userBubble.locator('img.attachment-image')).toBeVisible({ timeout: 5_000 })
    await expect(userBubble.locator('a.attachment-file')).not.toBeVisible()
  })

  test('image in bubble is not a broken placeholder — src is a blob URL or /bridge/ path', async ({ page }) => {
    await loadApp(page)

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(FIXTURE_IMAGE)
    await expect(page.locator('.preview-strip')).toBeVisible({ timeout: 5_000 })

    await page.locator('textarea[aria-label="Message"]').fill('test')
    await page.keyboard.press('Enter')

    const img = page.locator('article.msg-row.user').last().locator('img.attachment-image')
    await expect(img).toBeVisible({ timeout: 8_000 })

    const src = await img.getAttribute('src')
    expect(src).toBeTruthy()
    // Must be a blob URL (resolved) or a bridge path (fallback) — never empty or undefined
    const isBlob = src?.startsWith('blob:')
    const isBridge = src?.startsWith('/bridge/files/')
    expect(isBlob || isBridge).toBe(true)
  })

  test('non-image file attaches and renders as download link', async ({ page }) => {
    await loadApp(page)

    // Create a temp text file via the fixture image path trick — use a .txt instead
    const fileInput = page.locator('input[type="file"]')

    // Use setInputFiles with buffer for a text file
    await fileInput.setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello from e2e test'),
    })

    await expect(page.locator('.preview-strip')).toBeVisible({ timeout: 5_000 })

    await page.locator('textarea[aria-label="Message"]').fill('read this')
    await page.keyboard.press('Enter')

    const userBubble = page.locator('article.msg-row.user').last()
    await expect(userBubble).toBeVisible({ timeout: 8_000 })

    // Should be a link, NOT an img
    await expect(userBubble.locator('a.attachment-file')).toBeVisible({ timeout: 5_000 })
    await expect(userBubble.locator('img.attachment-image')).not.toBeVisible()
  })

  test('send without attachment works normally', async ({ page }) => {
    await loadApp(page)

    const textarea = page.locator('textarea[aria-label="Message"]')
    await textarea.fill('hello')
    await page.keyboard.press('Enter')

    // User bubble appears, no attachment elements
    const userBubble = page.locator('article.msg-row.user').last()
    await expect(userBubble).toBeVisible({ timeout: 8_000 })
    await expect(userBubble.locator('img.attachment-image')).not.toBeVisible()
    await expect(userBubble.locator('a.attachment-file')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Bridge health
// ---------------------------------------------------------------------------

test.describe('Bridge connectivity', () => {
  test('bridge health endpoint is reachable from the app origin', async ({ page }) => {
    await page.goto('/')
    const resp = await page.request.get('/bridge/health')
    expect(resp.ok()).toBe(true)

    const body = await resp.json()
    expect(body.status).toBe('ok')
    expect(Array.isArray(body.agents)).toBe(true)
    expect(body.agents.length).toBeGreaterThan(0)
  })

  test('bridge exposes expected agents (ash and/or six)', async ({ page }) => {
    await page.goto('/')
    const resp = await page.request.get('/bridge/health')
    const body = await resp.json()
    const ids: string[] = body.agents.map((a: { id: string }) => a.id)
    // At least one of the known agents must be present
    expect(ids.some((id) => ['ash', 'six', 'oc4929'].includes(id))).toBe(true)
  })

  test('bridge upload endpoint accepts an image and returns metadata', async ({ page }) => {
    await page.goto('/')
    const resp = await page.request.post('/bridge/upload', {
      multipart: {
        files: {
          name: 'fixture-red.png',
          mimeType: 'image/png',
          buffer: readFileSync(FIXTURE_IMAGE),
        },
      },
    })
    expect(resp.ok()).toBe(true)
    const [file] = await resp.json()
    expect(file.id).toBeTruthy()
    expect(file.content_type).toBe('image/png')
    expect(file.url).toMatch(/^\/bridge\/files\//)
  })

  test('uploaded file is immediately servable via /bridge/files/:id', async ({ page }) => {
    await page.goto('/')

    // Upload
    const uploadResp = await page.request.post('/bridge/upload', {
      multipart: {
        files: {
          name: 'fixture-red.png',
          mimeType: 'image/png',
          buffer: readFileSync(FIXTURE_IMAGE),
        },
      },
    })
    const [uploaded] = await uploadResp.json()

    // Serve
    const serveResp = await page.request.get(uploaded.url)
    expect(serveResp.ok()).toBe(true)
    expect(serveResp.headers()['content-type']).toContain('image/png')
  })

  test('jpeg with unicode filename + octet-stream MIME → infers image/jpeg from extension', async ({ page }) => {
    // Reproduces the real browser behaviour: browsers often send application/octet-stream
    // for files with Unicode filenames (e.g. 发臭.jpg, 起床了.jpg).
    // Without the fix, content_type would be application/octet-stream → renders as link not thumbnail.
    await page.goto('/')
    const resp = await page.request.post('/bridge/upload', {
      multipart: {
        files: {
          name: '发臭.jpg',
          mimeType: 'application/octet-stream',   // worst-case browser behaviour
          buffer: readFileSync(FIXTURE_IMAGE),
        },
      },
    })
    expect(resp.ok()).toBe(true)
    const [file] = await resp.json()
    expect(file.content_type).toBe('image/jpeg')  // must be inferred from .jpg extension
    expect(file.content_type).not.toBe('application/octet-stream')
  })

  test('png with octet-stream MIME → infers image/png from extension', async ({ page }) => {
    await page.goto('/')
    const resp = await page.request.post('/bridge/upload', {
      multipart: {
        files: {
          name: 'screenshot.png',
          mimeType: 'application/octet-stream',
          buffer: readFileSync(FIXTURE_IMAGE),
        },
      },
    })
    expect(resp.ok()).toBe(true)
    const [file] = await resp.json()
    expect(file.content_type).toBe('image/png')
  })

  test('correct MIME from browser is preserved as-is', async ({ page }) => {
    // When browser sends correct type, use it — don't override with extension lookup
    await page.goto('/')
    const resp = await page.request.post('/bridge/upload', {
      multipart: {
        files: {
          name: 'photo.jpg',
          mimeType: 'image/jpeg',
          buffer: readFileSync(FIXTURE_IMAGE),
        },
      },
    })
    const [file] = await resp.json()
    expect(file.content_type).toBe('image/jpeg')
  })

  test('uploaded image with inferred type is servable and returns correct Content-Type header', async ({ page }) => {
    // Full cycle: unicode + octet-stream → upload → serve → correct header
    await page.goto('/')
    const uploadResp = await page.request.post('/bridge/upload', {
      multipart: {
        files: {
          name: '起床了.jpg',
          mimeType: 'application/octet-stream',
          buffer: readFileSync(FIXTURE_IMAGE),
        },
      },
    })
    const [uploaded] = await uploadResp.json()
    expect(uploaded.content_type).toBe('image/jpeg')

    const serveResp = await page.request.get(uploaded.url)
    expect(serveResp.ok()).toBe(true)
    expect(serveResp.headers()['content-type']).toContain('image/jpeg')
  })
})
