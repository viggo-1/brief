import * as cheerio from 'cheerio';

/**
 * Scrapes the latest issue of a specific TLDR newsletter from the public web archives
 * @param {string} newsletter Name of the newsletter archive (e.g., 'tech', 'ai')
 * @param {string|null} dateString Specific date to fetch (e.g., '2026-04-08'), or null for latest
 * @returns {Promise<{date: string, subject: string, body: string}>}
 */
export async function fetchPublicTLDR(newsletter = 'tech', dateString = null) {
  console.log(`Starter HTTP-scraping af TLDR ${newsletter}...`);
  
  let targetDate = dateString;
  
  // Hvis ingen dato er angivet, find den nyeste dato i arkivet via en hurtig fetch
  if (!targetDate) {
    const archiveUrl = `https://tldr.tech/${newsletter}/archives`;
    console.log(`Henter arkiv-side for nyeste dato: ${archiveUrl}`);
    const archiveHtmlResponse = await fetch(archiveUrl);
    if (!archiveHtmlResponse.ok) {
      throw new Error(`Kunne ikke hente arkiv-side: ${archiveHtmlResponse.statusText}`);
    }
    const archiveHtml = await archiveHtmlResponse.text();
    
    // Find det første gyldige link til et nyhedsbrev (format: /tech/YYYY-MM-DD)
    const pattern = new RegExp(`/${newsletter}/(\\d{4}-\\d{2}-\\d{2})`);
    const match = archiveHtml.match(pattern);
    
    if (!match) {
      throw new Error(`Kunne ikke finde links til nyeste udgave i ${newsletter}-arkivet.`);
    }
    
    targetDate = match[1];
    console.log(`Nyeste udgave fundet i arkivet: ${targetDate}`);
  }
  
  const targetUrl = `https://tldr.tech/${newsletter}/${targetDate}`;
  console.log(`Henter nyhedsbrev fra: ${targetUrl}`);
  
  const response = await fetch(targetUrl);
  if (!response.ok) {
    throw new Error(`Kunne ikke hente nyhedsbrev: ${response.statusText}`);
  }
  const html = await response.text();
  
  const $ = cheerio.load(html);
  
  const title = $('h1').text().trim() || `TLDR ${newsletter.toUpperCase()} - ${targetDate}`;
  const subtitle = $('h2').text().trim() || '';
  
  let contentText = '';
  contentText += `Subject: TLDR ${newsletter.toUpperCase()} - ${targetDate}\n`;
  contentText += `Title: ${title}\n`;
  contentText += `Subtitle: ${subtitle}\n\n`;
  
  // Loop over alle sektioner (kategorier) og artikler
  $('section').each((_, section) => {
    const sectionHeader = $(section).find('h3').first().text().trim();
    if (sectionHeader && !sectionHeader.toLowerCase().includes('sponsor')) {
      contentText += `\n--- Category: ${sectionHeader} ---\n`;
    }
    
    $(section).find('article').each((_, article) => {
      const articleTitle = $(article).find('h3').text().trim();
      
      // Sorter sponsorer og reklamer fra
      if (!articleTitle || articleTitle.toLowerCase().includes('sponsor')) {
        return;
      }
      
      const articleLink = $(article).find('a').attr('href') || '';
      const articleText = $(article).find('.newsletter-html').text().trim();
      
      contentText += `Title: ${articleTitle}\n`;
      if (articleLink) {
        contentText += `Link: ${articleLink}\n`;
      }
      contentText += `Summary: ${articleText}\n\n`;
    });
  });
  
  // Hvis der ikke blev fundet nogen 'section'-elementer, prøv en flad parsing
  if (contentText.length < 150) {
    console.log('Ingen sektioner fundet via standard <section> selector. Prøver alternativ parsing...');
    
    $('article').each((_, article) => {
      const articleTitle = $(article).find('h3').text().trim();
      if (!articleTitle || articleTitle.toLowerCase().includes('sponsor')) {
        return;
      }
      
      const articleLink = $(article).find('a').attr('href') || '';
      const articleText = $(article).find('.newsletter-html').text().trim();
      
      contentText += `Title: ${articleTitle}\n`;
      if (articleLink) {
        contentText += `Link: ${articleLink}\n`;
      }
      contentText += `Summary: ${articleText}\n\n`;
    });
  }
  
  return {
    date: targetDate,
    subject: `TLDR ${newsletter.toUpperCase()} - ${targetDate}`,
    body: contentText
  };
}
