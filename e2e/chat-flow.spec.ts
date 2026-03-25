/**
 * Chat flow E2E — persistence, new chat, sidebar.
 *
 * Design principle: Tests that require the LLM (Ash) to respond are tagged @live
 * and excluded from CI. All other tests are pure bridge API or fast UI tests.
 */
import { test, expect, type Page } from '@playwright/test'

async function waitForBridge(page: Page) {
  for (let i = 0; i < 15; i++) {
    try { const r = await page.request.get('/bridge/health'); if (r.ok()) return } catch {}
    await page.waitForTimeout(300)
  }
  throw new Error('Bridge not reachable')
}

async function loadApp(page: Page) {
  await page.goto('/')
  await waitForBridge(page)
  await page.waitForSelector('.tab-item', { timeout: 10_000 })
}

async function sendMessage(page: Page, text: string) {
  await page.locator('textarea[aria-label="Message"]').fill(text)
  await page.keyboard.press('Enter')
}

// ---------------------------------------------------------------------------
// Bridge API — pure API, no LLM needed
// ---------------------------------------------------------------------------

test.describe('Bridge chat API', () => {
  test('GET /bridge/chats returns array', async ({ page }) => {
    await page.goto('/')
    expect(Array.isArray(await (await page.request.get('/bridge/chats')).json())).toBe(true)
  })

  test('GET /bridge/chats/:id 404 for unknown id', async ({ page }) => {
    await page.goto('/')
    expect((await page.request.get('/bridge/chats/does-not-exist')).status()).toBe(404)
  })

  test('POST /bridge/new → GET → DELETE lifecycle', async ({ page }) => {
    await page.goto('/')
    const { chatId } = await (await page.request.post('/bridge/new', {
      data: JSON.stringify({ agent: 'ash' }), headers: { 'Content-Type': 'application/json' },
    })).json()
    expect(typeof chatId).toBe('string')

    const detail = await (await page.request.get(`/bridge/chats/${chatId}`)).json()
    expect(detail.id).toBe(chatId)
    expect(Array.isArray(detail.messages)).toBe(true)

    await page.request.delete(`/bridge/chats/${chatId}`)
    expect((await page.request.get(`/bridge/chats/${chatId}`)).status()).toBe(404)
  })

  test('unknown agent returns 4xx', async ({ page }) => {
    await page.goto('/')
    const r = await page.request.post('/bridge/new', {
      data: JSON.stringify({ agent: 'no-such-agent' }), headers: { 'Content-Type': 'application/json' },
    })
    expect(r.ok()).toBe(false)
  })

  test('/bridge/chats/:id/load sets active chat', async ({ page }) => {
    await page.goto('/')
    const c1 = (await (await page.request.post('/bridge/new', { data: JSON.stringify({ agent: 'ash' }), headers: { 'Content-Type': 'application/json' } })).json()).chatId
    const c2 = (await (await page.request.post('/bridge/new', { data: JSON.stringify({ agent: 'ash' }), headers: { 'Content-Type': 'application/json' } })).json()).chatId

    await page.request.post(`/bridge/chats/${c1}/load`, { data: '{}', headers: { 'Content-Type': 'application/json' } })
    expect((await (await page.request.get('/bridge/history?agent=ash')).json()).chat_id).toBe(c1)

    await page.request.post(`/bridge/chats/${c2}/load`, { data: '{}', headers: { 'Content-Type': 'application/json' } })
    expect((await (await page.request.get('/bridge/history?agent=ash')).json()).chat_id).toBe(c2)
  })

  test('/bridge/history returns ok:true with messages array', async ({ page }) => {
    await page.goto('/')
    const b = await (await page.request.get('/bridge/history?agent=ash')).json()
    expect(b.ok).toBe(true)
    expect(b.agent_id).toBe('ash')
    expect(Array.isArray(b.payload?.messages)).toBe(true)
  })

  test('/bridge/search returns array; empty q returns []', async ({ page }) => {
    await page.goto('/')
    expect(Array.isArray(await (await page.request.get('/bridge/search?q=hello')).json())).toBe(true)
    const empty = await (await page.request.get('/bridge/search?q=')).json()
    expect(empty.length).toBe(0)
  })

  test('bridge health lists known agents', async ({ page }) => {
    await page.goto('/')
    const h = await (await page.request.get('/bridge/health')).json()
    expect(h.status).toBe('ok')
    const ids = h.agents.map((a: { id: string }) => a.id)
    expect(ids).toContain('ash')
    expect(ids).toContain('six')
  })
})

// ---------------------------------------------------------------------------
// UI — new chat button (no LLM response needed)
// ---------------------------------------------------------------------------

test.describe('New chat button', () => {
  test('clears message list', async ({ page }) => {
    await loadApp(page)
    page.on('dialog', (d) => d.accept())
    await page.locator('button[title="New conversation"]').click()
    await page.waitForTimeout(500)
    await expect(page.locator('article.msg-row')).toHaveCount(0, { timeout: 3_000 })
  })

  test('creates a DB entry via /bridge/new', async ({ page }) => {
    await loadApp(page)
    const before = (await (await page.request.get('/bridge/chats')).json()).length
    page.on('dialog', (d) => d.accept())
    await page.locator('button[title="New conversation"]').click()
    await page.waitForTimeout(900)
    const after = (await (await page.request.get('/bridge/chats')).json()).length
    expect(after).toBeGreaterThan(before)
  })

  test('send button disabled when text is empty', async ({ page }) => {
    await loadApp(page)
    page.on('dialog', (d) => d.accept())
    await page.locator('button[title="New conversation"]').click()
    await page.waitForTimeout(400)
    // Send button should be disabled with no text
    const sendBtn = page.locator('button[title="Send message"]')
    await expect(sendBtn).toBeDisabled({ timeout: 2_000 })
  })

  test('chatId is sent in bridge/send (not null) — regression for missing chatId bug', async ({ page }) => {
    await loadApp(page)
    page.on('dialog', (d) => d.accept())
    await page.locator('button[title="New conversation"]').click()
    await page.waitForTimeout(900)

    const sentChatIds: (string | undefined)[] = []
    await page.route('/bridge/send', async (route, request) => {
      const body = JSON.parse(request.postData() || '{}')
      sentChatIds.push(body.chatId)
      await route.abort() // Don't actually send — we just want to inspect the body
    })

    await sendMessage(page, 'chatid-regression-test')
    await page.waitForTimeout(500)

    expect(sentChatIds.length).toBeGreaterThan(0)
    expect(sentChatIds[0]).toBeTruthy()
    expect(typeof sentChatIds[0]).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// Sidebar — mobile viewport
// ---------------------------------------------------------------------------

test.describe('Sidebar (mobile)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('menu button visible on mobile', async ({ page }) => {
    await loadApp(page)
    await expect(page.locator('button[title="Open chats"]')).toBeVisible()
  })

  test('menu button opens sidebar', async ({ page }) => {
    await loadApp(page)
    await expect(page.locator('aside.sidebar.open')).not.toBeVisible()
    await page.locator('button[title="Open chats"]').click()
    await expect(page.locator('aside.sidebar.open')).toBeVisible({ timeout: 3_000 })
  })

  test('backdrop click closes sidebar', async ({ page }) => {
    await loadApp(page)
    await page.locator('button[title="Open chats"]').click()
    await expect(page.locator('.sidebar-backdrop')).toBeVisible({ timeout: 3_000 })
    await page.locator('.sidebar-backdrop').click()
    await expect(page.locator('.sidebar-backdrop')).not.toBeVisible({ timeout: 3_000 })
  })
})

// ---------------------------------------------------------------------------
// Sidebar — desktop (CSS regression: menu-btn was hidden at >=768px)
// ---------------------------------------------------------------------------

test.describe('Sidebar (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('sidebar is open by default on desktop', async ({ page }) => {
    await loadApp(page)
    await expect(page.locator('aside.sidebar.open')).toBeVisible({ timeout: 3_000 })
  })

  test('menu button visible on desktop (was hidden — now fixed)', async ({ page }) => {
    await loadApp(page)
    await expect(page.locator('button[title="Open chats"]')).toBeVisible()
  })

  test('menu button toggles sidebar', async ({ page }) => {
    await loadApp(page)
    await expect(page.locator('aside.sidebar.open')).toBeVisible({ timeout: 3_000 })
    // Close
    await page.locator('button[title="Open chats"]').click()
    await page.waitForTimeout(300)
    await expect(page.locator('aside.sidebar.open')).not.toBeVisible({ timeout: 2_000 })
    // Reopen
    await page.locator('button[title="Open chats"]').click()
    await expect(page.locator('aside.sidebar.open')).toBeVisible({ timeout: 3_000 })
  })
})
