import { chromium } from 'playwright';

const URL = 'https://askclaw.top';
const USER = 'demo';
const PASS = 'demo2026';
const AUTH = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

async function shoot(lang) {
  const label = lang === 'zh' ? 'zh' : 'en';

  // Desktop
  {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      httpCredentials: { username: USER, password: PASS },
      extraHTTPHeaders: { Authorization: AUTH },
    });
    const page = await ctx.newPage();

    // Set language before navigating
    await page.addInitScript((l) => localStorage.setItem('askclaw_lang', l), lang);
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `docs/screenshots/desktop-empty-${label}.png` });
    console.log(`✓ desktop-empty-${label}.png`);

    // Send a message
    try {
      const ta = page.locator('textarea').first();
      await ta.waitFor({ state: 'visible', timeout: 8000 });
      const question = lang === 'zh' ? '你是什么？用一句话介绍。' : 'What is AskClaw? One sentence.';
      await ta.fill(question);
      await ta.press('Enter');
      await page.waitForTimeout(10000);
      await page.screenshot({ path: `docs/screenshots/desktop-chat-${label}.png` });
      console.log(`✓ desktop-chat-${label}.png`);
    } catch (e) {
      console.log(`  chat screenshot skipped (${label}):`, e.message.split('\n')[0]);
    }

    await ctx.close();
  }

  // Mobile
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      httpCredentials: { username: USER, password: PASS },
      extraHTTPHeaders: { Authorization: AUTH },
    });
    const page = await ctx.newPage();
    await page.addInitScript((l) => localStorage.setItem('askclaw_lang', l), lang);
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `docs/screenshots/mobile-${label}.png` });
    console.log(`✓ mobile-${label}.png`);
    await ctx.close();
  }
}

await shoot('en');
await shoot('zh');

await browser.close();
console.log('Done.');
