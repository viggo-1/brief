import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Henter godkendte Gmail API klient
 */
export async function getGmailClient() {
  let credentials;
  let token;

  // Prioriter environment variables (skyen / GitHub Actions)
  if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN) {
    credentials = {
      web: {
        client_id: process.env.GMAIL_CLIENT_ID,
        client_secret: process.env.GMAIL_CLIENT_SECRET,
        redirect_uris: ['http://localhost:3000/oauth2callback']
      }
    };
    token = {
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    };
  } else {
    // Fald tilbage til lokale filer (lokal test)
    if (!fs.existsSync(CREDENTIALS_PATH) || !fs.existsSync(TOKEN_PATH)) {
      throw new Error('Gmail OAuth legitimationsoplysninger ikke fundet. Kør "npm run auth-setup" først.');
    }
    credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    token = JSON.parse(fs.readFileSync(TOKEN_PATH));
  }

  const { client_secret, client_id, redirect_uris } = credentials.web || credentials.installed || {};
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(token);

  return google.gmail({ version: 'v1', auth: oAuth2Client });
}

/**
 * Henter krop-indholdet fra en Gmail beskeddel (rekursiv)
 */
function getBody(payload) {
  let body = '';
  
  if (payload.body && payload.body.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf8');
  }
  
  if (payload.parts) {
    // Foretræk text/plain frem for text/html for nemmere AI opsummering
    const plainTextPart = payload.parts.find(part => part.mimeType === 'text/plain');
    if (plainTextPart) {
      return getBody(plainTextPart);
    }
    
    const htmlPart = payload.parts.find(part => part.mimeType === 'text/html');
    if (htmlPart) {
      return getBody(htmlPart);
    }
    
    // Hvis ingen af dem findes, tjek under-dele
    for (const part of payload.parts) {
      body += getBody(part);
    }
  }
  
  return body;
}

/**
 * Henter nyhedsbreve fra de seneste 24 timer
 * @param {string} query Gmail søge-forespørgsel (f.eks. 'subject:TLDR')
 */
export async function fetchNewsletters(query = 'subject:"TLDR"') {
  console.log(`Forbinder til Gmail API...`);
  const gmail = await getGmailClient();
  
  // Beregn timestamp for 24 timer siden for at sikre nøjagtighed
  const oneDayAgoSeconds = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
  const fullQuery = `${query} after:${oneDayAgoSeconds}`;
  
  console.log(`Søger i Gmail efter: "${fullQuery}"`);
  
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: fullQuery,
  });

  const messages = response.data.messages || [];
  console.log(`Fundet ${messages.length} nyhedsbreve matching forespørgslen.`);

  const newsletters = [];

  for (const msgInfo of messages) {
    const details = await gmail.users.messages.get({
      userId: 'me',
      id: msgInfo.id,
      format: 'full',
    });

    const headers = details.data.payload.headers;
    const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || 'Intet emne';
    const date = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';
    const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';

    console.log(`Henter: "${subject}" fra ${from}`);

    const body = getBody(details.data.payload);

    newsletters.push({
      id: msgInfo.id,
      subject,
      from,
      date,
      body,
    });
  }

  return newsletters;
}
