import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fetchNewsletters } from './gmail.js';
import { generateBriefing } from './summarizer.js';
import { generatePodcast } from './notebooklm.js';
import { addEpisodeToPodcast } from './podcast.js';

dotenv.config();

const OUTPUT_DIR = path.join(process.cwd(), 'output');

// Opret output mappen hvis den ikke findes
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function main() {
  const start = Date.now();
  console.log('==================================================');
  console.log('          Brief: Morning News Agent Start         ');
  console.log('==================================================');
  
  // Hent dagens dato i formatet YYYY-MM-DD
  const now = new Date();
  const dateString = now.toISOString().split('T')[0];
  console.log(`Dato: ${dateString}`);
  console.log(`Tidspunkt: ${now.toLocaleTimeString()}`);
  console.log('--------------------------------------------------\n');

  try {
    // 1. Hent nyhedsbreve fra Gmail
    console.log('[TRIN 1] Henter TLDR nyhedsbreve fra de seneste 24 timer...');
    const newsletters = await fetchNewsletters('subject:"TLDR"');
    
    if (newsletters.length === 0) {
      console.log('\n[INFO] Der blev ikke fundet nogen nye TLDR nyhedsbreve inden for de seneste 24 timer.');
      console.log('Afbryder processen yndefuldt da der ikke er nyt indhold at omdanne til podcast.');
      console.log('\n==================================================');
      console.log('           Daily Brief Agent Afsluttet            ');
      console.log('==================================================');
      return;
    }

    console.log(`[INFO] Hentet ${newsletters.length} nyhedsbrev(e) med succes.\n`);

    // 2. Generer briefing med Gemini
    console.log('[TRIN 2] Konsoliderer og opsummerer nyheder via Gemini...');
    const briefingText = await generateBriefing(newsletters);
    
    // Gem briefing som Markdown fil til backup/arkiv
    const briefingFilePath = path.join(OUTPUT_DIR, `briefing-${dateString}.md`);
    fs.writeFileSync(briefingFilePath, briefingText, 'utf8');
    console.log(`[INFO] Opsummering gemt lokalt som backup på: ${briefingFilePath}\n`);

    // 3. Generer podcast med NotebookLM via Playwright
    console.log('[TRIN 3] Automater NotebookLM for at generere lydfil...');
    const tempAudioPath = await generatePodcast(briefingText, dateString);
    console.log(`[INFO] Lydfil genereret og klar til integration: ${tempAudioPath}\n`);

    // 4. Integrer lydfil i Podcast RSS feed
    console.log('[TRIN 4] Tilføjer episode til podcast RSS feed (podcast.xml)...');
    await addEpisodeToPodcast(tempAudioPath, dateString);
    
    // 5. Ryd op i midlertidige filer
    console.log('[TRIN 5] Rydder op i midlertidige filer...');
    try {
      if (fs.existsSync(tempAudioPath)) {
        fs.unlinkSync(tempAudioPath);
        console.log(`Midlertidig lydfil slettet: ${tempAudioPath}`);
      }
    } catch (e) {
      console.warn('Kunne ikke slette midlertidig lydfil:', e);
    }

    const durationSeconds = Math.floor((Date.now() - start) / 1000);
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;

    console.log('\n==================================================');
    console.log('🎉   Daily Brief Agent Gennemført med Succes!    🎉');
    console.log(`Tid brugt: ${minutes}m ${seconds}s`);
    console.log(`Dit podcast-feed er klar til afspilning!`);
    console.log('==================================================');

  } catch (error) {
    console.error('\n🔴 [KRITISK FEJL] Agent-flowet fejlede under kørsel:');
    console.error(error);
    
    const durationSeconds = Math.floor((Date.now() - start) / 1000);
    console.log(`\nFlowet fejlede efter ${durationSeconds} sekunder.`);
    console.log('==================================================');
    process.exit(1);
  }
}

main();
