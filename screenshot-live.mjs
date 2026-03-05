import { chromium } from 'playwright';

const URL = 'https://askclaw.top';
const USER = 'demo';
const PASS = 'demo2026';
const AUTH = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

// Desktop - empty state
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    httpCredentials: { username: USER, password: PASS },
    extraHTTPHeaders: { 'Authorization': AUTH },
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/root/2602/screenshot-desktop.png' });
  console.log('✓ screenshot-desktop.png');

  // Log visible text for debugging
  const body = await page.locator('body').textContent();
  console.log('Page text (first 300):', body?.slice(0, 300));

  // Try to find any input
  const inputs = await page.locator('textarea, input').count();
  console.log('Inputs found:', inputs);

  // Try typing in textarea if visible
  try {
    const ta = page.locator('textarea').first();
    await ta.waitFor({ state: 'visible', timeout: 5000 });
    await ta.fill('Describe yourself in one sentence.');
    await ta.press('Enter');
    await page.waitForTimeout(10000);
    await page.screenshot({ path: '/root/2602/screenshot-desktop-chat.png' });
    console.log('✓ screenshot-desktop-chat.png');
  } catch (e) {
    console.log('Chat screenshot skipped:', e.message.split('\n')[0]);
  }

  await ctx.close();
}

// Mobile
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    httpCredentials: { username: USER, password: PASS },
    extraHTTPHeaders: { 'Authorization': AUTH },
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/root/2602/screenshot-mobile.png' });
  console.log('✓ screenshot-mobile.png');
  await ctx.close();
}

await browser.close();
console.log('Done.');
