import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const AUTH_STATE_PATH = '/Users/viggo/Desktop/code/brief/auth_state.json';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--no-sandbox']
  });

  const context = await browser.newContext({
    storageState: AUTH_STATE_PATH,
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();
  console.log('Navigating to NotebookLM...');
  await page.goto('https://notebooklm.google.com/', { waitUntil: 'domcontentloaded' });
  
  console.log('Waiting 8 seconds for redirects to happen...');
  await page.waitForTimeout(8000);
  
  console.log('Current URL:', page.url());
  
  // Save a screenshot
  await page.screenshot({ path: '/Users/viggo/Desktop/code/brief/output/selector_test.png' });
  console.log('Screenshot saved to output/selector_test.png');

  // Let's find any button or div on the page that has viggoebbesen
  const elCount = await page.locator('*').count();
  console.log('Total elements on page:', elCount);

  // Let's run JS in the page to find the elements
  const elementsInfo = await page.evaluate(() => {
    const list = [];
    document.querySelectorAll('*').forEach(el => {
      const text = el.textContent || '';
      const email = el.getAttribute('data-email') || '';
      const id = el.id || '';
      const className = el.className || '';
      const isVisible = el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
      
      if (email.includes('viggo') || text.includes('viggoebbesen')) {
        list.push({
          tagName: el.tagName,
          id,
          className,
          email,
          text: text.substring(0, 100).trim(),
          isVisible
        });
      }
    });
    return list;
  });

  console.log('Elements matching viggo:', JSON.stringify(elementsInfo, null, 2));

  // Let's test specific Playwright selectors
  const selectorsToTest = [
    'button:has-text("viggoebbesen@gmail.com")',
    'button:has-text("Viggo Ebbesen")',
    '[data-email="viggoebbesen@gmail.com"]',
    'text=viggoebbesen@gmail.com',
    'text=Viggo Ebbesen',
    'div[data-email="viggoebbesen@gmail.com"]'
  ];

  for (const sel of selectorsToTest) {
    const loc = page.locator(sel).first();
    const count = await loc.count();
    const visible = count > 0 ? await loc.isVisible() : false;
    console.log(`Selector "${sel}": count=${count}, isVisible=${visible}`);
  }

  await browser.close();
}

main().catch(console.error);
