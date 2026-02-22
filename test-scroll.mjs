import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
await page.goto('http://localhost:4321/mixer', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: '/Users/jura/Git/kolacik/mixer-debug.png' });
await browser.close();
