# Walkthrough & Setup Guide - Brief: Daily News Podcast

Dette projekt er nu **fuldt implementeret, testet og automatiseret** direkte på din Mac i mappen `/Users/viggo/Desktop/code/brief`.

I stedet for en kompleks opsætning i skyen, kører løsningen som et intelligent, lokalt **AI-agent-flow** orkestreret af Antigravity. Hver morgen scraper agenten de nyeste teknologi- og AI-nyheder, opsummerer dem via Gemini med et ultra-præcist executive vidensniveau, uploader dem til NotebookLM for at generere en 2-værts podcast, konverterer lydfilen til streambar **M4A (AAC)**, og skubber resultatet op til din GitHub Pages, så du kan lytte fejlfrit i **Apple Podcasts** på din iPhone!

---

## 📁 Projektstruktur & Filer

De vigtigste komponenter i dit projekt er:

1. **src/notebooklm.js**: Browser-agenten, der genindlæser din Google-session, uploader briefingen til NotebookLM, genererer den to-værts podcast og downloader lydfilen som en højopløselig `.wav` via den opdaterede tre-punkts dropdown-menu (`.artifact-more-button`).
2. **src/tldr-scraper.js**: Scraperen, der henter de nyeste udgaver af TLDR Tech og TLDR AI direkte fra de offentlige arkiver (hvilket fuldstændig fjerner behovet for komplekse Gmail API-nøgler og godkendelser!).
3. **src/summarizer.js**: Gemini-agenten (`gemini-2.5-flash`), der konsoliderer og strukturerer nyhederne til en ultra-præcis, højt begavet executive-briefing optimeret til NotebookLM. Den antager fuld forhåndsviden og undgår banale forklaringer, hvilket tvinger NotebookLM-værterne til at tale på et strategisk CEO/CTO-niveau.
4. **src/podcast.js**: Konverterer automatisk `.wav` filerne til streambare `.m4a` (AAC ved 128kbps) via macOS afconvert, og opdaterer `podcast.xml` (RSS-feedet) med **100% historisk bevarelse** af alle tidligere episoder.
5. **scripts/auth-refresh.js**: Vores semi-automatiserede fornyer, som lader dig forny din Google-session med ét enkelt klik på skærmen uden at bruge terminalen.
6. **podcast/podcast.xml**: RSS-feedet, som indlæses af Apple Podcasts (nu med streambare `.m4a` referencer).
7. **podcast/audio/**: Mappen, hvor alle dine historiske lydfiler bevares som streambare `.m4a` filer.

---

## 🤖 Fuldautomatisk Morgen-Rutin (Antigravity Cron)

Jeg har oprettet og aktiveret en **Antigravity Planlagt Opgave (Cron)**, som orkestrerer det hele automatisk:
* **Tidspunkt:** Hver morgen kl. **06:30** lokal dansk tid.
* **Opgave:** Antigravity vågner automatisk, kører pipeline-kommandoen (`npm start`), henter den genererede podcast-lydfil fra NotebookLM, opdaterer dit RSS-feed lokalt, og skubber (pusher) ændringerne op til din GitHub, så de bliver serveret via din GitHub Pages.
* **Hukommelse og login:** Processen bruger din personlige Google-konto (`viggoebbesen@gmail.com`) gennem den krypterede og gemte session i `auth_state.json`.

---

## 📱 Sådan lytter du på din iPhone (Apple Podcasts)

Dagens test-episode er allerede uploadet og live! Du kan tilføje podcasten til din iPhone med det samme:

1. Åbn **Apple Podcasts**-appen på din iPhone.
2. Gå til fanen **Bibliotek** (Library) i bunden.
3. Tryk på de tre prikker `...` i øverste højre hjørne.
4. Vælg **"Tilføj en podcast via URL..."** (Add a Podcast by URL...).
5. Indtast din personlige offentlige RSS-URL:
   `https://viggo-1.github.io/brief/podcast/podcast.xml`
6. Tryk på **Abonner** (Subscribe).

**Færdig!** Apple Podcasts vil nu automatisk hente dagens episode og hente nye episoder hver eneste morgen, så snart Antigravity-rutinen har kørt kl. 06:30.

---

## 🔄 Vedligeholdelse & Fornyelse af Google Session

Google-sessioner (cookies) udløber typisk efter et par uger eller måneder. Hvis Antigravity melder om fejl i login næste måned, kan du forny sessionen super nemt uden at røre terminalen:

1. Bed Antigravity om at køre: `npm run auth-refresh`.
2. Chrome vil åbne på din skærm med Googles login-side.
3. Klik på din konto `viggoebbesen@gmail.com`, indtast password/2FA, og så snart du er logget ind, **lukker vinduet sig selv og gemmer den nye session automatisk!**
