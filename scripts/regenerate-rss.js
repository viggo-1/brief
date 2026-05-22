import fs from 'fs';
import path from 'path';
import { addEpisodeToPodcast } from '../src/podcast.js';

const PODCAST_DIR = path.join(process.cwd(), 'podcast');
const AUDIO_DIR = path.join(PODCAST_DIR, 'audio');

async function main() {
  const dateString = '2026-05-21';
  console.log(`[Regenerate] Starter regenerering af RSS-feeds med HTML Show Notes for ${dateString}...`);
  
  // 1. Regenerer Executive Briefing RSS feed
  const execXmlPath = path.join(PODCAST_DIR, 'podcast.xml');
  if (fs.existsSync(execXmlPath)) {
    fs.unlinkSync(execXmlPath);
    console.log('Slettede gammel podcast.xml');
  }
  
  const execAudioPath = path.join(AUDIO_DIR, `briefing-${dateString}.m4a`);
  if (fs.existsSync(execAudioPath)) {
    console.log(`Genererer Executive RSS med lydfil fra ${execAudioPath}...`);
    // Vi opretter en midlertidig filreference, så addEpisodeToPodcast tror det er den oprindelige .m4a fil
    await addEpisodeToPodcast(execAudioPath, dateString, 'executive');
  } else {
    console.warn(`Kunne ikke finde Executive lydfil: ${execAudioPath}`);
  }
  
  // 2. Regenerer TLDR Speed-Brief RSS feed
  const tldrXmlPath = path.join(PODCAST_DIR, 'tldr_podcast.xml');
  if (fs.existsSync(tldrXmlPath)) {
    fs.unlinkSync(tldrXmlPath);
    console.log('Slettede gammel tldr_podcast.xml');
  }
  
  const tldrAudioPath = path.join(AUDIO_DIR, `tldr-briefing-${dateString}.m4a`);
  if (fs.existsSync(tldrAudioPath)) {
    console.log(`Genererer TLDR RSS med lydfil fra ${tldrAudioPath}...`);
    await addEpisodeToPodcast(tldrAudioPath, dateString, 'tldr');
  } else {
    console.warn(`Kunne ikke finde TLDR lydfil: ${tldrAudioPath}`);
  }
  
  console.log('[SUCCESS] Begge RSS-feeds er blevet regenereret med de nye rige HTML Show Notes!');
}

main().catch(console.error);
