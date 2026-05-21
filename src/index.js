import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fetchPublicTLDR } from './tldr-scraper.js';
import { fetchExecutiveNews } from './news-aggregator.js';
import { generateExecutiveBriefing, generateTLDRSpeedBriefing } from './summarizer.js';
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
  console.log('      Brief: Dual-Podcast Morning Agent Start     ');
  console.log('==================================================');
  
  // Hent dagens dato i formatet YYYY-MM-DD
  const now = new Date();
  const dateString = now.toISOString().split('T')[0];
  console.log(`Dato: ${dateString}`);
  console.log(`Tidspunkt: ${now.toLocaleTimeString()}`);
  console.log('--------------------------------------------------\n');

  let execSuccess = false;
  let tldrSuccess = false;

  // ==========================================
  // PIPELINE 1: EXECUTIVE BRIEFING (TECH & STRATEGY)
  // ==========================================
  console.log('>>> [START] PIPELINE 1: EXECUTIVE BRIEFING <<<');
  try {
    console.log('[TRIN 1.1] Henter high-signal executive nyheder...');
    const rawExecText = await fetchExecutiveNews();

    if (!rawExecText || rawExecText.trim().length < 200) {
      console.warn('[ADVARSEL] Ingen tilstrækkelig executive nyhedsdata fundet. Springer over.');
    } else {
      console.log('[TRIN 1.2] Konsoliderer og opsummerer via Gemini (Executive Advisor)...');
      const briefingText = await generateExecutiveBriefing(rawExecText);
      
      // Gem backup markdown
      const briefingFilePath = path.join(OUTPUT_DIR, `briefing-${dateString}.md`);
      fs.writeFileSync(briefingFilePath, briefingText, 'utf8');
      console.log(`[Executive] Backup gemt på: ${briefingFilePath}`);

      console.log('[TRIN 1.3] Automater NotebookLM for at generere Executive lydfil...');
      const tempAudioPath = await generatePodcast(briefingText, dateString);
      
      console.log('[TRIN 1.4] Integrer i Executive Podcast RSS feed...');
      await addEpisodeToPodcast(tempAudioPath, dateString, 'executive');

      // Ryd op
      try {
        if (fs.existsSync(tempAudioPath)) {
          fs.unlinkSync(tempAudioPath);
          console.log(`[Executive] Midlertidig lydfil slettet: ${tempAudioPath}`);
        }
      } catch (e) {
        console.warn('Kunne ikke slette midlertidig Executive lydfil:', e);
      }
      
      execSuccess = true;
      console.log('🎉 [SUCCESS] Pipeline 1: Executive Briefing gennemført fejlfrit!\n');
    }
  } catch (error) {
    console.error('\n🔴 [FEJL] Pipeline 1: Executive Briefing fejlede under afvikling:');
    console.error(error);
    console.log('Fortsætter til næste pipeline...\n');
  }

  // ==========================================
  // PIPELINE 2: TLDR SPEED-BRIEF (DAILY DIGEST)
  // ==========================================
  console.log('\n>>> [START] PIPELINE 2: TLDR SPEED-BRIEF <<<');
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
      console.warn('[ADVARSEL] Ingen TLDR nyhedsbreve hentet. Springer over.');
    } else {
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

      tldrSuccess = true;
      console.log('🎉 [SUCCESS] Pipeline 2: TLDR Speed-Brief gennemført fejlfrit!\n');
    }
  } catch (error) {
    console.error('\n🔴 [FEJL] Pipeline 2: TLDR Speed-Brief fejlede under afvikling:');
    console.error(error);
  }

  // ==========================================
  // RAPPORT OG AFSLUTNING
  // ==========================================
  const durationSeconds = Math.floor((Date.now() - start) / 1000);
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  console.log('\n==================================================');
  console.log('🎉          Daily Brief Agent Afsluttet           🎉');
  console.log(`Tid brugt: ${minutes}m ${seconds}s`);
  console.log('--------------------------------------------------');
  console.log(`Executive Briefing: ${execSuccess ? 'SUCCES ✅' : 'FEJLEDE/SPRUNGET OVER ❌'}`);
  console.log(`TLDR Speed-Brief:   ${tldrSuccess ? 'SUCCES ✅' : 'FEJLEDE/SPRUNGET OVER ❌'}`);
  console.log('==================================================');

  // Hvis begge fejler, afslut med fejlkode
  if (!execSuccess && !tldrSuccess) {
    console.error('Begge pipelines fejlede. Afslutter med fejlstatus.');
    process.exit(1);
  }
}

main();
