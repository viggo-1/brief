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
    channel: 'chrome',
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
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
    await page.goto('https://notebooklm.google.com/', { waitUntil: 'domcontentloaded' });
    await saveDebugScreenshot(page, '01_homepage');

    // Tjek om vi er logget ind (hvis login-knap findes, er sessionen udløbet)
    const loginButton = await page.locator('text=Sign in').first().isVisible().catch(() => false);
    if (loginButton) {
      throw new Error('Google-sessionen i auth_state.json er udløbet eller ugyldig. Kør venligst "npm run auth-setup" igen for at forny dit login.');
    }

    console.log('Opretter ny notesbog...');
    // Find knappen til at oprette en ny notesbog.
    // NotebookLM har normalt et "New notebook" kort eller knap.
    const createButton = page.locator('button, [role="button"], a').filter({
      hasText: /New notebook|Create notebook|Opret/i
    }).or(
      page.locator('text=/New notebook|Create notebook|Opret/i')
    ).first();
    
    await createButton.waitFor({ state: 'visible' });
    await createButton.click();
    
    console.log('Venter på at notesbogen oprettes og kilde-popup vises...');
    await page.waitForTimeout(5000);
    await saveDebugScreenshot(page, '02_notebook_created');

    console.log('Tilføjer kilde (Copied text)...');
    // Vi vælger "Copied text" muligheden, da det er den mest pålidelige måde at indsætte rå tekst
    const copiedTextOption = page.locator('button, [role="button"], a').filter({
      hasText: /Copied text|Paste text|Kopieret|Indsæt/i
    }).or(
      page.locator('text=/Copied text|Paste text|Kopieret|Indsæt/i')
    ).first();
    
    await copiedTextOption.waitFor({ state: 'visible' });
    await copiedTextOption.click();
    await saveDebugScreenshot(page, '03_copied_text_modal');

    // Udfyld kildens titel og indhold
    console.log('Indsætter briefingtekst...');
    
    // Nogle versioner af NotebookLM har et særskilt titelfelt, andre ikke. Vi gør det valgfrit.
    const sourceTitleInput = page.locator('input[placeholder*="Title" i], input[placeholder*="Titel" i]').first();
    if (await sourceTitleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sourceTitleInput.fill(`Daily Briefing - ${dateString}`);
      console.log('Titel indsat.');
    } else {
      console.log('Intet titelfelt fundet eller synligt. Omgår titelfelt...');
    }

    // Indsæt selve teksten i den korrekte copiedText textarea med fokus og blur for at trigge Angular-validering
    const sourceTextarea = page.locator('textarea[formcontrolname="copiedText"], textarea.copied-text-input-textarea').first();
    await sourceTextarea.focus();
    await sourceTextarea.fill(briefingText);
    await sourceTextarea.blur();
    await page.waitForTimeout(2000); // Vent på at valideringen opdateres og knappen aktiveres
    
    await saveDebugScreenshot(page, '04_briefing_inserted');

    // Klik på tilføj/gem knappen specifikt inde i dialog-overlayet for at undgå baggrundsknapper
    const addSourceButton = page.locator('mat-dialog-container button, [role="dialog"] button, .mat-mdc-dialog-container button').filter({
      hasText: /Add|Save|Gem|Tilføj|Indsæt|Insert/i
    }).first();
    await addSourceButton.click();

    console.log('Venter på at kilden behandles (processing)...');
    // Vent til modal lukker og kilden dukker op. Vi giver det op til 45 sekunder.
    await page.waitForTimeout(10000); 
    await saveDebugScreenshot(page, '05_source_processing_done');

    // Åbn Notebook Guide / Studio panelet i højre side
    console.log('Åbner Notebook Guide...');
    const guideButton = page.locator('button, [role="button"], a').filter({
      hasText: /Notebook guide|Studio|Guide/i
    }).or(
      page.locator('text=/Notebook guide|Studio|Guide/i')
    ).first();
    
    if (await guideButton.isVisible()) {
      await guideButton.click();
      await page.waitForTimeout(2000);
      await saveDebugScreenshot(page, '06_guide_opened');
    }

    // Klik på "Audio Overview / Audiooverblik" kortet for at åbne detalje-panelet i 2026 UI
    console.log('Klikker på Audio Overview kortet...');
    const audioCard = page.locator('[aria-label*="Audiooverblik" i], [aria-label*="Audio overview" i], .create-artifact-button-container').filter({
      hasText: /Audiooverblik|Audio overview/i
    }).first();

    await audioCard.waitFor({ state: 'visible' });
    await audioCard.click();
    console.log('Lydoverblik-kort klikket. Venter 2 sekunder på at panelet glider op...');
    await page.waitForTimeout(2000);
    await saveDebugScreenshot(page, '06b_audio_card_clicked');

    // Tjek om generering allerede er startet automatisk (f.eks. "Genererer audiooverblik...")
    const isAlreadyGenerating = await page.locator('text=/Genererer audiooverblik|Generating audio overview|Genererer|Generating/i').isVisible().catch(() => false);
    
    if (isAlreadyGenerating) {
      console.log('Generering er allerede startet automatisk! Springer klik på Generer-knap over.');
    } else {
      console.log('Søger efter Generer-knap specifikt i Studio-panelet for at undgå baggrundsknapper...');
      // Vi søger efter knappen specifikt i Studio/højre side for at undgå "+ Opret notesbog" i headeren
      const generateAudioButton = page.locator('mat-sidenav button, .studio-panel button, [class*="studio" i] button, [class*="sidebar" i] button').filter({
        hasText: /Generate|Opret|Gener[eé]r/i
      }).first();
      
      if (await generateAudioButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await generateAudioButton.click();
        console.log('Generering startet manuelt via knap!');
      } else {
        console.log('Ingen specifik Generer-knap fundet. Antager at generering kører...');
      }
    }
    console.log('Venter på at podcasten bliver klar (dette tager normalt 3-7 minutter)...');
    await saveDebugScreenshot(page, '07_generation_started');

    // Vi laver en løkke, der venter på, at genereringen færdiggøres.
    // Vi tjekker hvert 15. sekund i op til 15 minutter.
    const maxWaitTimeMs = 15 * 60 * 1000; // 15 minutter
    const checkIntervalMs = 15000; // 15 sekunder
    let elapsed = 0;
    let isDone = false;
    let moreButton = null;

    while (elapsed < maxWaitTimeMs) {
      await page.waitForTimeout(checkIntervalMs);
      elapsed += checkIntervalMs;
      
      console.log(`Har ventet i ${Math.floor(elapsed / 1000)} sekunder...`);
      await saveDebugScreenshot(page, '08_generation_progress');

      // Tjek efter tre-punkts menuen (artifact-more-button), som indikerer at genereringen er færdig
      moreButton = page.locator('.artifact-more-button').first();

      const hasMoreButton = await moreButton.isVisible().catch(() => false);
      
      // Vi tjekker også om der er fejlbeskeder
      const hasError = await page.locator('text=Could not generate, Fejl, Error, Fejlede').isVisible().catch(() => false);
      if (hasError) {
        throw new Error('NotebookLM fejlede under lydgenereringen.');
      }

      if (hasMoreButton) {
        console.log('[SUCCESS] Podcast lydfilen er genereret færdig! Tre-punkts menuen er fundet.');
        isDone = true;
        break;
      }
    }

    if (!isDone || !moreButton) {
      throw new Error('Genereringen tog for lang tid (timeout efter 15 minutter) eller tre-punkts menuen blev ikke fundet.');
    }

    // Klik på tre-punkts menuen for at åbne dropdownen
    console.log('Klikker på tre-punkts menuen...');
    await moreButton.click();
    await page.waitForTimeout(2000); // Vent på at menuen åbnes
    await saveDebugScreenshot(page, '08b_dropdown_opened');

    // Find "Download" eller "Hent" knappen i dropdown-menuen
    console.log('Søger efter Download/Hent knap i menuen...');
    const downloadMenuItem = page.locator('[role="menuitem"], button, a').filter({
      hasText: /Download|Hent/i
    }).first();

    const hasDownloadItem = await downloadMenuItem.isVisible().catch(() => false);
    if (!hasDownloadItem) {
      console.warn('Advarsel: Kunne ikke finde Download/Hent tekst i menupunkter. Prøver at lede efter enhver synlig knap med matchende tekst...');
    }

    // Download filen
    console.log('Downloader podcast lydfil...');
    const downloadPath = path.join(OUTPUT_DIR, `briefing-${dateString}.wav`);
    
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }), // 1 minut timeout til at starte download
      downloadMenuItem.click()
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
