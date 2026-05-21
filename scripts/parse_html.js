import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const htmlPath = '/Users/viggo/Desktop/code/brief/output/error_page_source.html';
if (!fs.existsSync(htmlPath)) {
  console.log('Error page source file does not exist at:', htmlPath);
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
console.log('HTML length:', html.length);

const $ = cheerio.load(html);

// Find any buttons or divs that might represent the account chooser cards
console.log('Finding elements matching email...');
const matches = [];
$('*').each((i, el) => {
  const text = $(el).text();
  const emailAttr = $(el).attr('data-email');
  if (emailAttr && emailAttr.includes('viggo')) {
    matches.push({ tag: el.name, emailAttr, text: text.substring(0, 100) });
  } else if (text && text.includes('viggoebbesen')) {
    matches.push({ tag: el.name, text: text.substring(0, 100) });
  }
});

console.log('Matches:', JSON.stringify(matches, null, 2));

// List all buttons on the page
console.log('Listing all button texts:');
$('button').each((i, el) => {
  console.log(`Button ${i}:`, $(el).text().trim());
});
