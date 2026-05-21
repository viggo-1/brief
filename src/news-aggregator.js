import * as cheerio from 'cheerio';

/**
 * Fetches and aggregates the latest high-signal tech and strategy articles
 * from Techmeme, SemiAnalysis, Stratechery, and Import AI.
 * @returns {Promise<string>} Combined plain-text context for the summarizer
 */
export async function fetchExecutiveNews() {
  console.log('[Aggregator] Henter executive nyhedskilder...');
  
  const sources = [
    { name: 'Techmeme', url: 'https://www.techmeme.com/feed.xml', isAggregator: true },
    { name: 'SemiAnalysis', url: 'https://semianalysis.substack.com/feed', isAggregator: false },
    { name: 'Stratechery', url: 'https://stratechery.com/feed/', isAggregator: false },
    { name: 'Import AI', url: 'https://importai.substack.com/feed', isAggregator: false }
  ];

  let combinedText = '';
  const now = new Date();
  // Vi kigger 5 dage tilbage for specialistblogs for at sikre, at vi fanger ugentlige/lejlighedsvise dybdegående indlæg
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  for (const src of sources) {
    try {
      console.log(`[Aggregator] Henter feed for ${src.name}: ${src.url}`);
      const res = await fetch(src.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (!res.ok) {
        console.warn(`[Aggregator WARNING] Kunne ikke hente ${src.name}: ${res.statusText}`);
        continue;
      }
      
      const xml = await res.text();
      const $ = cheerio.load(xml, { xmlMode: true });

      combinedText += `\n--- SOURCE: ${src.name} ---\n`;
      let count = 0;

      $('item').each((_, item) => {
        const title = $(item).find('title').text().trim();
        const link = $(item).find('link').text().trim();
        const pubDateText = $(item).find('pubDate').text().trim();
        
        // Få fat i description eller indhold
        let description = $(item).find('description').text().trim() || 
                          $(item).find('content\\:encoded').text().trim() ||
                          $(item).find('content').text().trim();

        // Rengør description for HTML tags og forkort for at begrænse token forbrug
        const cleanDesc = cheerio.load(description).text().trim().replace(/\s+/g, ' ').substring(0, 1200);

        if (src.isAggregator) {
          // For Techmeme (aggregator) tager vi de første 15 historier på forsiden
          if (count >= 15) return;
          combinedText += `Title: ${title}\nLink: ${link}\nSummary: ${cleanDesc}\n\n`;
          count++;
        } else {
          // For specifikke blogs tjekker vi om de er udgivet for nylig (inden for 5 dage)
          const pubDate = new Date(pubDateText);
          if (isNaN(pubDate.getTime()) || pubDate >= fiveDaysAgo) {
            combinedText += `Title: ${title}\nLink: ${link}\nPublished: ${pubDateText}\nSummary: ${cleanDesc}\n\n`;
            count++;
          }
        }
      });

      console.log(`[Aggregator] Hentet ${count} artikler fra ${src.name}.`);
    } catch (e) {
      console.error(`[Aggregator ERROR] Fejl under hentning af ${src.name}:`, e.message);
    }
  }

  return combinedText;
}
