import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const AUTH_STATE_PATH = path.join(process.cwd(), 'auth_state.json');
const OUTPUT_DIR = path.join(process.cwd(), 'output');

// Opret output mappe hvis den ikke findes
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Automates NotebookLM to upload a briefing and generate the podcast audio
 * @param {string} briefingText The markdown text of the briefing
 * @param {string} dateString Date string for naming (e.g., '2026-05-21')
 * @returns {Promise<string>} Path to the downloaded audio file
 */
export async function generatePodcast(briefingText, dateString) {
  if (!fs.existsSync(AUTH_STATE_PATH)) {
    throw new Error(`Kunde ikke finde Google sessionstate i ${AUTH_STATE_PATH}. Kør venligst "npm run auth-setup" først.`);
  }

  const isHeadless = process.env.HEADLESS !== 'false';
  console.log(`Starter Playwright Browser (Headless: ${isHeadless})...`);

  const browser = await chromium.launch({
    headless: isHeadless,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Indlæs eksisterende Google session (cookies, localStorage osv.)
  const context = await browser.newContext({
    storageState: AUTH_STATE_PATH,
    viewport: { width: 1280, height: 800 },
    acceptDownloads: true
  });

  const page = await context.newPage();
  
  // Sæt en standard timeout på 30 sekunder for hurtige handlinger
  page.setDefaultTimeout(30000);

  try {
    console.log('Navigerer til NotebookLM...');
    await page.goto('https://notebooklm.google.com/', { waitUntil: 'networkidle' });
    await saveDebugScreenshot(page, '01_homepage');

    // Tjek om vi er logget ind (hvis login-knap findes, er sessionen udløbet)
    const loginButton = await page.locator('text=Sign in').first().isVisible().catch(() => false);
    if (loginButton) {
      throw new Error('Google-sessionen i auth_state.json er udløbet eller ugyldig. Kør venligst "npm run auth-setup" igen for at forny dit login.');
    }

    console.log('Opretter ny notesbog...');
    // Find knappen til at oprette en ny notesbog.
    // NotebookLM har normalt et "New notebook" kort eller knap.
    const createButton = page.locator('text=New notebook, Create notebook, Opret notesbog').or(
      page.getByRole('button', { name: /New notebook|Create notebook|Opret notesbog/i })
    ).first();
    
    await createButton.waitFor({ state: 'visible' });
    await createButton.click();
    
    console.log('Venter på at notesbogen oprettes og kilde-popup vises...');
    await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
    await saveDebugScreenshot(page, '02_notebook_created');

    console.log('Tilføjer kilde (Copied text)...');
    // Vi vælger "Copied text" muligheden, da det er den mest pålidelige måde at indsætte rå tekst
    const copiedTextOption = page.locator('text=Copied text, Indsæt tekst, Paste text').or(
      page.getByRole('button', { name: /Copied text|Paste text/i })
    ).first();
    
    await copiedTextOption.waitFor({ state: 'visible' });
    await copiedTextOption.click();
    await saveDebugScreenshot(page, '03_copied_text_modal');

    // Udfyld kildens titel og indhold
    console.log('Indsætter briefingtekst...');
    const sourceTitleInput = page.locator('input[placeholder*="Title", input[type="text"]').first();
    await sourceTitleInput.fill(`Daily Briefing - ${dateString}`);

    // Indsæt selve teksten i textarea
    const sourceTextarea = page.locator('textarea[placeholder*="Paste", textarea').first();
    await sourceTextarea.fill(briefingText);
    
    await saveDebugScreenshot(page, '04_briefing_inserted');

    // Klik på tilføj/gem knappen
    const addSourceButton = page.locator('text=Add, Save, Gem, Tilføj').or(
      page.getByRole('button', { name: /Add|Save|Gem|Tilføj/i })
    ).first();
    await addSourceButton.click();

    console.log('Venter på at kilden behandles (processing)...');
    // Vent til modal lukker og kilden dukker op. Vi giver det op til 45 sekunder.
    await page.waitForTimeout(10000); 
    await saveDebugScreenshot(page, '05_source_processing_done');

    // Åbn Notebook Guide / Studio panelet i højre side
    console.log('Åbner Notebook Guide...');
    const guideButton = page.locator('text=Notebook guide, Studio, Guide').or(
      page.getByRole('button', { name: /Notebook guide|Studio|Guide/i })
    ).first();
    
    if (await guideButton.isVisible()) {
      await guideButton.click();
      await page.waitForTimeout(2000);
      await saveDebugScreenshot(page, '06_guide_opened');
    }

    // Find "Audio Overview" sektionen og klik "Generate"
    console.log('Starter generering af Audio Overview (podcast)...');
    const generateAudioButton = page.locator('text=Generate, Opret, Generate Audio Overview').or(
      page.getByRole('button', { name: /Generate|Opret/i })
    ).first();
    
    await generateAudioButton.waitFor({ state: 'visible' });
    await generateAudioButton.click();
    console.log('Generering startet! Venter på at podcasten bliver klar (dette tager normalt 3-7 minutter)...');
    await saveDebugScreenshot(page, '07_generation_started');

    // Vi laver en løkke, der venter på, at genereringen færdiggøres.
    // Vi tjekker hvert 15. sekund i op til 10 minutter.
    const maxWaitTimeMs = 10 * 60 * 1000; // 10 minutter
    const checkIntervalMs = 15000; // 15 sekunder
    let elapsed = 0;
    let isDone = false;
    let downloadButton = null;

    while (elapsed < maxWaitTimeMs) {
      await page.waitForTimeout(checkIntervalMs);
      elapsed += checkIntervalMs;
      
      console.log(`Har ventet i ${Math.floor(elapsed / 1000)} sekunder...`);
      await saveDebugScreenshot(page, '08_generation_progress');

      // Tjek om der er dukket en download knap op, eller om "Generating" teksten er væk.
      downloadButton = page.locator('button[aria-label*="Download"], text=Download').or(
        page.getByRole('button', { name: /Download/i })
      ).first();

      const hasDownload = await downloadButton.isVisible().catch(() => false);
      
      // Vi tjekker også om der er fejlbeskeder
      const hasError = await page.locator('text=Could not generate, Fejl, Error').isVisible().catch(() => false);
      if (hasError) {
        throw new Error('NotebookLM fejlede under lydgenereringen.');
      }

      if (hasDownload) {
        console.log('[SUCCESS] Podcast lydfilen er genereret færdig!');
        isDone = true;
        break;
      }
    }

    if (!isDone || !downloadButton) {
      throw new Error('Genereringen tog for lang tid (timeout efter 10 minutter) eller download-knappen blev ikke fundet.');
    }

    // Download filen
    console.log('Downloader podcast lydfil...');
    const downloadPath = path.join(OUTPUT_DIR, `briefing-${dateString}.wav`);
    
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }), // 1 minut timeout til at starte download
      downloadButton.click()
    ]);

    await download.saveAs(downloadPath);
    console.log(`[SUCCESS] Lydfilen er gemt på: ${downloadPath}`);
    await saveDebugScreenshot(page, '09_download_complete');

    // Vi returnerer stien til den downloadede fil
    return downloadPath;

  } catch (error) {
    console.error('Der skete en fejl under automatisering af NotebookLM:', error);
    await saveDebugScreenshot(page, 'ERROR_STATE');
    
    // Log HTML indhold af siden til fejlfinding i logfilen
    try {
      const htmlContent = await page.content();
      fs.writeFileSync(path.join(OUTPUT_DIR, 'error_page_source.html'), htmlContent);
      console.log(`HTML-kildekode for fejlside gemt i output/error_page_source.html`);
    } catch (e) {
      console.error('Kunne ikke gemme HTML fejlside:', e);
    }
    
    throw error;
  } finally {
    console.log('Lukker browseren...');
    await browser.close();
  }
}

/**
 * Hjælpefunktion til at gemme skærmbilleder undervejs til fejlfinding
 */
async function saveDebugScreenshot(page, stepName) {
  try {
    const screenshotPath = path.join(OUTPUT_DIR, `${stepName}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`[Screenshot] Gemt debug screenshot: ${screenshotPath}`);
  } catch (e) {
    console.error(`Kunne ikke gemme screenshot for ${stepName}:`, e);
  }
}
