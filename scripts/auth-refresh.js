import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import dotenv from 'dotenv';

dotenv.config();

const AUTH_STATE_PATH = path.join(process.cwd(), 'auth_state.json');

async function main() {
  console.log('==================================================');
  console.log('       Brief: Automatisk Login-Fornyer Start      ');
  console.log('==================================================');
  console.log('Åbner en synlig browser på din skærm...');
  console.log('Venligst vælg din konto / indtast adgangskode / gennemfør 2FA hvis nødvendigt.');
  console.log('Så snart du er logget ind, lukkes vinduet automatisk og sessionen gemmes!\n');

  const launchOptions = {
    headless: false,
    channel: 'chrome',
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  };

  // Brug eksisterende session state hvis den findes for at bevare konto-hukommelse
  const contextOptions = {
    viewport: { width: 1280, height: 800 }
  };
  if (fs.existsSync(AUTH_STATE_PATH)) {
    contextOptions.storageState = AUTH_STATE_PATH;
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  await page.goto('https://notebooklm.google.com/');

  // Vent på at logge ind
  const timeoutMs = 10 * 60 * 1000; // 10 minutter max
  const checkIntervalMs = 1500;
  let elapsed = 0;
  let success = false;

  while (elapsed < timeoutMs) {
    await page.waitForTimeout(checkIntervalMs);
    elapsed += checkIntervalMs;

    // Tjek om vi er på NotebookLM dashboardet ved at lede efter Opret/New Notebook knapper
    const dashboardButton = page.locator('button, [role="button"], a').filter({
      hasText: /New notebook|Create notebook|Opret/i
    }).or(
      page.locator('text=/New notebook|Create notebook|Opret/i')
    ).first();

    const isVisible = await dashboardButton.isVisible().catch(() => false);
    const currentUrl = page.url();
    const pageTitle = await page.title().catch(() => 'Ukendt titel');
    
    // Gem løbende skærmbillede til fejlfinding
    if (elapsed % 5000 === 0) {
      await page.screenshot({ path: path.join(process.cwd(), 'output', 'auth_refresh_state.png') }).catch(() => {});
    }

    const isOnNotebookLM = currentUrl.includes('notebooklm.google.com') && !currentUrl.includes('accounts.google.com') && !currentUrl.includes('/login');
    if (isOnNotebookLM && isVisible) {
      console.log(`\n[SUCCESS] Du er logget ind! URL: ${currentUrl}, Titel: ${pageTitle}`);
      console.log('Gemmer den friske session til auth_state.json...');
      
      await context.storageState({ path: AUTH_STATE_PATH });
      console.log('Session gemt succesfuldt!');
      success = true;
      break;
    }
    
    if (elapsed % 15000 === 0) {
      console.log(`Venter på login... URL: ${currentUrl} (${Math.floor(elapsed / 1000)}s / 300s)`);
    }
  }

  await browser.close();

  if (success) {
    console.log('\n==================================================');
    console.log('🎉      Sessionen er fornyet med succes!          🎉');
    console.log('==================================================');
    process.exit(0);
  } else {
    console.error('\n🔴 [FEJL] Login tog for lang tid eller mislykkedes.');
    console.log('==================================================');
    process.exit(1);
  }
}

main().catch(console.error);
