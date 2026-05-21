import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config();

const PODCAST_DIR = path.join(process.cwd(), 'podcast');
const AUDIO_DIR = path.join(PODCAST_DIR, 'audio');

// Opret mapper hvis de ikke findes
if (!fs.existsSync(PODCAST_DIR)) {
  fs.mkdirSync(PODCAST_DIR, { recursive: true });
}
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

/**
 * Registrerer den nye lydfil i det relevante RSS-feed
 * @param {string} tempAudioPath Stien til den downloadede midlertidige lydfil
 * @param {string} dateString Datoen for briefingen (f.eks. '2026-05-21')
 * @param {string} type Type af podcast ('executive' eller 'tldr')
 * @returns {Promise<void>}
 */
export async function addEpisodeToPodcast(tempAudioPath, dateString, type = 'executive') {
  if (!fs.existsSync(tempAudioPath)) {
    throw new Error(`Kilde lydfilen blev ikke fundet på: ${tempAudioPath}`);
  }

  const ext = path.extname(tempAudioPath).toLowerCase();
  let finalAudioPath = '';
  let finalFilename = '';
  let mimeType = '';
  
  // Bestem filnavn-prefix baseret på podcast-type
  const prefix = type === 'tldr' ? 'tldr-briefing' : 'briefing';

  if (ext === '.wav') {
    // Vi vil konvertere .wav til .m4a (AAC) for at sikre fuld understøttelse af streaming i Apple Podcasts på iOS
    finalFilename = `${prefix}-${dateString}.m4a`;
    finalAudioPath = path.join(AUDIO_DIR, finalFilename);
    mimeType = 'audio/x-m4a';

    console.log(`[Podcast - ${type.toUpperCase()}] Konverterer ${tempAudioPath} til M4A (AAC) via afconvert...`);
    try {
      // afconvert: AAC at 128 kbps, highest quality (-q 127)
      const cmd = `/usr/bin/afconvert -f m4af -d aac -b 128000 -q 127 "${tempAudioPath}" "${finalAudioPath}"`;
      console.log(`[Podcast - ${type.toUpperCase()}] Afvikler: ${cmd}`);
      execSync(cmd);
      console.log(`[Podcast - ${type.toUpperCase()}] Lydfil succesfuldt konverteret og gemt på: ${finalAudioPath}`);
    } catch (err) {
      console.error(`[Podcast - ${type.toUpperCase()}] Fejl under afconvert konvertering. Falder tilbage til .wav-fil:`, err);
      // Fallback: Kopier original .wav
      const fallbackFilename = `${prefix}-${dateString}.wav`;
      const fallbackAudioPath = path.join(AUDIO_DIR, fallbackFilename);
      fs.copyFileSync(tempAudioPath, fallbackAudioPath);
      finalFilename = fallbackFilename;
      finalAudioPath = fallbackAudioPath;
      mimeType = 'audio/wav';
    }
  } else {
    // Hvis filen allerede er f.eks. .mp3
    const finalExt = ext || '.mp3';
    finalFilename = `${prefix}-${dateString}${finalExt}`;
    finalAudioPath = path.join(AUDIO_DIR, finalFilename);
    mimeType = finalExt === '.mp3' ? 'audio/mpeg' : 'audio/wav';
    
    fs.copyFileSync(tempAudioPath, finalAudioPath);
    console.log(`[Podcast - ${type.toUpperCase()}] Lydfil kopieret uden konvertering til: ${finalAudioPath}`);
  }

  // Få filstørrelse i bytes (kræves af podcast RSS standarden)
  const stats = fs.statSync(finalAudioPath);
  const fileSizeInBytes = stats.size;

  // Bestem RSS sti og konfigurér metadata
  const rssFilename = type === 'tldr' ? 'tldr_podcast.xml' : 'podcast.xml';
  const rssPath = path.join(PODCAST_DIR, rssFilename);

  // Metadata standardværdier
  const defaultTitle = type === 'tldr' ? 'TLDR Speed-Brief: Daily Digest' : 'Executive Briefing: Tech & Strategy';
  const defaultDesc = type === 'tldr'
    ? 'Snappy daily run-through of the general technology and AI landscape, curated from TLDR newsletters.'
    : 'Elite strategic technology and macro-infrastructure briefing for executives.';

  const title = (type === 'tldr' ? process.env.TLDR_PODCAST_TITLE : process.env.PODCAST_TITLE) || defaultTitle;
  const description = (type === 'tldr' ? process.env.TLDR_PODCAST_DESCRIPTION : process.env.PODCAST_DESCRIPTION) || defaultDesc;
  const author = process.env.PODCAST_AUTHOR || 'Viggo';
  const siteUrl = process.env.PODCAST_SITE_URL || 'https://your-username.github.io/brief/';
  
  const baseSiteUrl = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
  const audioFileUrl = `${baseSiteUrl}podcast/audio/${finalFilename}`;

  // Formater udgivelsesdato til RFC 822 format (f.eks. "Thu, 21 May 2026 06:00:00 GMT")
  const pubDate = new Date().toUTCString();
  const guid = `brief-${type}-${dateString}-${Math.random().toString(36).substr(2, 9)}`;

  // Opret det nye podcast-element (episode)
  const newEpisodeItem = `    <item>
      <title>${type === 'tldr' ? 'TLDR Speed-Brief' : 'Executive Briefing'} - ${dateString}</title>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>
      <enclosure url="${audioFileUrl}" length="${fileSizeInBytes}" type="${mimeType}" />
      <guid isPermaLink="false">${guid}</guid>
      <itunes:author>${author}</itunes:author>
      <itunes:summary>${description}</itunes:summary>
      <itunes:duration>${type === 'tldr' ? '02:30' : '05:00'}</itunes:duration>
    </item>`;

  const coverFilename = type === 'tldr' ? 'tldr_cover.png' : 'executive_cover.png';
  const coverUrl = `${baseSiteUrl}podcast/${coverFilename}`;

  let rssContent = '';

  if (fs.existsSync(rssPath)) {
    console.log(`Opdaterer eksisterende RSS-feed på ${rssFilename}...`);
    const existingContent = fs.readFileSync(rssPath, 'utf8');

    // Vi finder stedet lige efter det første <item>
    const itemIndex = existingContent.indexOf('<item>');
    
    if (itemIndex !== -1) {
      // Indsæt den nye episode før de eksisterende episoder for at holde det nyeste øverst
      rssContent = existingContent.slice(0, itemIndex) + newEpisodeItem + '\n\n' + existingContent.slice(itemIndex);
    } else {
      // Hvis der ikke er nogen episoder endnu, indsæt før </channel>
      const channelEndIndex = existingContent.indexOf('</channel>');
      if (channelEndIndex !== -1) {
        rssContent = existingContent.slice(0, channelEndIndex) + '  ' + newEpisodeItem + '\n  ' + existingContent.slice(channelEndIndex);
      } else {
        // Hvis XML er korrupt, generer et nyt
        rssContent = generateNewRss(title, description, baseSiteUrl, author, newEpisodeItem, coverUrl);
      }
    }
  } else {
    console.log(`Opretter et helt nyt RSS-feed på ${rssFilename}...`);
    rssContent = generateNewRss(title, description, baseSiteUrl, author, newEpisodeItem, coverUrl);
  }

  // Gem det opdaterede RSS-feed
  fs.writeFileSync(rssPath, rssContent, 'utf8');
  console.log(`[SUCCESS] Podcast RSS-feed opdateret på: ${rssPath}`);
}

/**
 * Genererer en helt ny podcast.xml struktur
 */
function generateNewRss(title, description, baseSiteUrl, author, episodeItem, coverUrl) {
  const finalCoverUrl = coverUrl || 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=1400&amp;h=1400&amp;fit=crop';
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" 
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${title}</title>
    <link>${baseSiteUrl}</link>
    <language>en-us</language>
    <copyright>Copyright ${new Date().getFullYear()} ${author}</copyright>
    <itunes:author>${author}</itunes:author>
    <itunes:summary>${description}</itunes:summary>
    <description>${description}</description>
    <itunes:owner>
      <itunes:name>${author}</itunes:name>
      <itunes:email>brief-podcast@example.com</itunes:email>
    </itunes:owner>
    <itunes:category text="Technology" />
    <itunes:explicit>no</itunes:explicit>
    <itunes:image href="${finalCoverUrl}" />
    
${episodeItem}

  </channel>
</rss>`;
}
