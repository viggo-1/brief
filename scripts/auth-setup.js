import fs from 'fs';
import path from 'path';
import http from 'http';
import { google } from 'googleapis';
import { chromium } from 'playwright';
import readline from 'readline';
import { exec } from 'child_process';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const AUTH_STATE_PATH = path.join(process.cwd(), 'auth_state.json');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('==================================================');
  console.log('       Brief: Velkommen til Autentificering-Setup  ');
  console.log('==================================================\n');
  console.log('Dette script hjælper dig med at opsætte:');
  console.log('1. Gmail API (Hent TLDR-nyhedsbreve)');
  console.log('2. Google Session til NotebookLM (Playwright Cookies)\n');

  console.log('Vælg en mulighed:');
  console.log('1. Konfigurer Gmail API OAuth2 (Kræver credentials.json)');
  console.log('2. Konfigurer NotebookLM Playwright Google Session');
  console.log('3. Opsæt begge');
  console.log('4. Afslut\n');

  const choice = await question('Indtast valg (1-4): ');

  if (choice === '1' || choice === '3') {
    await setupGmail();
  }

  if (choice === '2' || choice === '3') {
    await setupNotebookLM();
  }

  console.log('\nSetup færdigt! Du kan nu køre appen.');
  rl.close();
}

async function setupGmail() {
  console.log('\n--- 1. Gmail API Opsætning ---');
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('\n[FEJL] Kunne ikke finde credentials.json i projektmappen.');
    console.log('\nSådan henter du credentials.json:');
    console.log('1. Gå til Google Cloud Console (https://console.cloud.google.com/)');
    console.log('2. Opret et nyt projekt.');
    console.log('3. Gå til "APIs & Services" > "Library" og søg efter "Gmail API", og AKTIVER det.');
    console.log('4. Gå til "APIs & Services" > "OAuth consent screen". Vælg "External" (eller Internal hvis Google Workspace), udfyld mindst de påkrævede felter.');
    console.log('5. Under "Scopes" tilføj: https://www.googleapis.com/auth/gmail.readonly');
    console.log('6. Under "Test users" tilføj din e-mail (viggo@boombutik.dk).');
    console.log('7. Gå til "Credentials" > "Create Credentials" > "OAuth client ID".');
    console.log('8. Vælg Application Type: "Web application".');
    console.log('9. Tilføj Authorized redirect URIs: http://localhost:3000/oauth2callback');
    console.log('10. Download JSON-filen, omdøb den til "credentials.json" og læg den i denne mappe:\n    ' + process.cwd());
    return;
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_secret, client_id, redirect_uris } = credentials.web || credentials.installed || {};
  const redirectUri = redirect_uris ? redirect_uris[0] : 'http://localhost:3000/oauth2callback';

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Tvinger til at give refresh token hver gang under setup
  });

  console.log('\nÅbner browseren for godkendelse...');
  console.log('Hvis browseren ikke åbner, skal du klikke på dette link:\n', authUrl);

  // Åbn browseren på Mac
  exec(`open "${authUrl.replace(/&/g, '\\&')}"`);

  // Start en lokal server til at modtage OAuth2 callback
  await new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url.startsWith('/oauth2callback')) {
          const q = url.parse(req.url, true).query;
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>Godkendelse lykkedes!</h1><p>Du kan nu lukke denne fane og vende tilbage til terminalen.</p>');
          
          server.close();

          const { tokens } = await oAuth2Client.getToken(q.code);
          oAuth2Client.setCredentials(tokens);

          fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
          console.log('\n[SUCCESS] Gmail API token gemt i token.json!');
          console.log('\n--- Kopier disse til dine GitHub Secrets ---');
          console.log('GMAIL_CLIENT_ID:', client_id);
          console.log('GMAIL_CLIENT_SECRET:', client_secret);
          console.log('GMAIL_REFRESH_TOKEN:', tokens.refresh_token);
          console.log('--------------------------------------------');
          
          resolve();
        }
      } catch (err) {
        console.error('Fejl under modtagelse af token:', err);
        res.writeHead(500);
        res.end('Fejl!');
        server.close();
        resolve();
      }
    }).listen(3000);
  });
}

async function setupNotebookLM() {
  console.log('\n--- 2. NotebookLM Playwright Google Session Opsætning ---');
  console.log('Vi åbner nu en synlig Chromium-browser.');
  console.log('1. Log ind på din Google-konto (viggo@boombutik.dk).');
  console.log('2. Gennemfør eventuel 2FA (To-faktor-godkendelse).');
  console.log('3. Når du er logget ind, og du ser NotebookLM startskærmen, skal du vende tilbage hertil og trykke ENTER.');
  
  await question('\nTryk ENTER for at starte browseren...');

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();
  await page.goto('https://notebooklm.google.com/');

  await question('\nLog ind i browseren, og tryk ENTER her i terminalen, når du er helt klar...');

  await context.storageState({ path: AUTH_STATE_PATH });
  console.log(`\n[SUCCESS] Google-session er gemt i ${AUTH_STATE_PATH}!`);
  console.log('Denne fil indeholder dine cookies og sessionstoken, så Playwright kan køre fuldautomatisk fremover.');
  console.log('Hold denne fil hemmelig, og tilføj den ALDRIG til et offentligt repository.');
  
  await browser.close();
}

main().catch(console.error);
