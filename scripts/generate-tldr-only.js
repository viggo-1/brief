import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fetchPublicTLDR } from '../src/tldr-scraper.js';
import { generateTLDRSpeedBriefing } from '../src/summarizer.js';
import { generatePodcast } from '../src/notebooklm.js';
import { addEpisodeToPodcast } from '../src/podcast.js';

dotenv.config();

const OUTPUT_DIR = path.join(process.cwd(), 'output');

async function main() {
  const start = Date.now();
  console.log('==================================================');
  console.log('   Brief: ONLY TLDR Speed-Brief Pipeline Start    ');
  console.log('==================================================');
  
  const now = new Date();
  const dateString = now.toISOString().split('T')[0];
  console.log(`Dato: ${dateString}`);
  console.log(`Tidspunkt: ${now.toLocaleTimeString()}`);
  console.log('--------------------------------------------------\n');

  try {
    console.log('[TRIN 2.1] Henter nyhedsbreve fra de offentlige TLDR arkiver...');
    const newsletters = [];
    
    try {
      console.log('Henter TLDR Tech...');
      const techNL = await fetchPublicTLDR('tech');
      newsletters.push(techNL);
    } catch (e) {
      console.warn('Kunne ikke hente TLDR Tech:', e.message);
    }
    
    try {
      console.log('Henter TLDR AI...');
      const aiNL = await fetchPublicTLDR('ai');
      newsletters.push(aiNL);
    } catch (e) {
      console.warn('Kunne ikke hente TLDR AI:', e.message);
    }

    if (newsletters.length === 0) {
      console.warn('[ADVARSEL] Ingen TLDR nyhedsbreve hentet. Afbryder.');
      process.exit(1);
    }

    console.log('[TRIN 2.2] Konsoliderer og opsummerer til Speed-Brief via Gemini...');
    const briefingText = await generateTLDRSpeedBriefing(newsletters);
    
    // Gem backup markdown
    const briefingFilePath = path.join(OUTPUT_DIR, `tldr-briefing-${dateString}.md`);
    fs.writeFileSync(briefingFilePath, briefingText, 'utf8');
    console.log(`[TLDR Speed-Brief] Backup gemt på: ${briefingFilePath}`);

    console.log('[TRIN 2.3] Automater NotebookLM for at generere Speed-Brief lydfil...');
    const tempAudioPath = await generatePodcast(briefingText, dateString);
    
    console.log('[TRIN 2.4] Integrer i TLDR Speed-Brief Podcast RSS feed...');
    await addEpisodeToPodcast(tempAudioPath, dateString, 'tldr');

    // Ryd op
    try {
      if (fs.existsSync(tempAudioPath)) {
        fs.unlinkSync(tempAudioPath);
        console.log(`[TLDR Speed-Brief] Midlertidig lydfil slettet: ${tempAudioPath}`);
      }
    } catch (e) {
      console.warn('Kunne ikke slette midlertidig TLDR lydfil:', e);
    }

    const durationSeconds = Math.floor((Date.now() - start) / 1000);
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    
    console.log('==================================================');
    console.log(`🎉 [SUCCESS] Pipeline 2 (TLDR) færdiggjort på ${minutes}m ${seconds}s!`);
    console.log('==================================================');
  } catch (error) {
    console.error('\n🔴 [FEJL] Pipeline 2: TLDR Speed-Brief fejlede under afvikling:');
    console.error(error);
    process.exit(1);
  }
}

main();
