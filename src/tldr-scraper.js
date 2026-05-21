import { chromium } from 'playwright';

/**
 * Scrapes the latest issue of a specific TLDR newsletter from the public web archives
 * @param {string} newsletter Name of the newsletter archive (e.g., 'tech', 'ai')
 * @param {string|null} dateString Specific date to fetch (e.g., '2026-04-08'), or null for latest
 * @returns {Promise<{date: string, subject: string, body: string}>}
 */
export async function fetchPublicTLDR(newsletter = 'tech', dateString = null) {
  console.log(`Starter Playwright til public scraping af TLDR ${newsletter}...`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    let targetDate = dateString;
    
    // Hvis ingen dato er angivet, find den nyeste dato i arkivet
    if (!targetDate) {
      const archiveUrl = `https://tldr.tech/${newsletter}/archives`;
      console.log(`Tjekker arkiv-side for nyeste dato: ${archiveUrl}`);
      await page.goto(archiveUrl, { waitUntil: 'networkidle' });
      
      // Find det første gyldige link til et nyhedsbrev (format: /tech/YYYY-MM-DD)
      const latestLink = await page.evaluate((ns) => {
        const links = Array.from(document.querySelectorAll('a'));
        const pattern = new RegExp(`^/${ns}/\\d{4}-\\d{2}-\\d{2}$`);
        const matchingLink = links.find(a => pattern.test(a.getAttribute('href') || ''));
        return matchingLink ? matchingLink.getAttribute('href') : null;
      }, newsletter);
      
      if (!latestLink) {
        throw new Error(`Kunne ikke finde links til nyeste udgave i ${newsletter}-arkivet.`);
      }
      
      targetDate = latestLink.split('/').pop();
      console.log(`Nyeste udgave fundet i arkivet: ${targetDate}`);
    }
    
    const targetUrl = `https://tldr.tech/${newsletter}/${targetDate}`;
    console.log(`Henter nyhedsbrev fra: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'networkidle' });
    
    // Ekstraher artiklerne fra siden
    const newsletterData = await page.evaluate((ns, date) => {
      let contentText = '';
      const title = document.querySelector('h1')?.textContent || '';
      const subtitle = document.querySelector('h2')?.textContent || '';
      
      contentText += `Subject: TLDR ${ns.toUpperCase()} - ${date}\n`;
      contentText += `Title: ${title}\n`;
      contentText += `Subtitle: ${subtitle}\n\n`;
      
      // Loop over alle sektioner (kategorier) i nyhedsbrevet
      const sections = Array.from(document.querySelectorAll('section'));
      sections.forEach(section => {
        const sectionHeader = section.querySelector('h3')?.textContent || '';
        if (sectionHeader.trim()) {
          contentText += `\n--- Category: ${sectionHeader.trim()} ---\n`;
        }
        
        const articles = Array.from(section.querySelectorAll('article'));
        articles.forEach(article => {
          const articleTitle = article.querySelector('h3')?.textContent || '';
          
          // Filtrer sponsorer og reklamer fra
          if (articleTitle.toLowerCase().includes('sponsor')) {
            return;
          }
          
          const articleLink = article.querySelector('a')?.getAttribute('href') || '';
          const articleText = article.querySelector('.newsletter-html')?.textContent || '';
          
          if (articleTitle.trim()) {
            contentText += `Title: ${articleTitle.trim()}\n`;
            if (articleLink) contentText += `Link: ${articleLink}\n`;
            contentText += `Summary: ${articleText.trim()}\n\n`;
          }
        });
      });
      
      return contentText;
    }, newsletter, targetDate);
    
    return {
      date: targetDate,
      subject: `TLDR ${newsletter.toUpperCase()} - ${targetDate}`,
      body: newsletterData
    };
    
  } finally {
    await browser.close();
  }
}
