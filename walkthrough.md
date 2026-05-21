# Walkthrough & Statusrapport - Brief: Dual-Podcast System

Begge dine podcasts – **Executive Briefing** og **TLDR Speed-Brief** – er nu **100% succesfuldt genereret, konverteret og udgivet** live via GitHub Pages til din iPhone!

---

## 📊 Aktuel Status (21. maj 2026)

Alle processer er gennemført fejlfrit, og alle ændringer er skubbet (pushet) til din GitHub-repo. 

### 1. 🎙️ Executive Briefing: Tech & Strategy
* **Lydfil:** `podcast/audio/briefing-2026-05-21.m4a` (AAC, 128 kbps, streambar)
* **RSS Feed:** `https://viggo-1.github.io/brief/podcast/podcast.xml`
* **Cover Art:** `https://viggo-1.github.io/brief/podcast/executive_cover.png` (Premium mørkt/blåt CEO-tema)
* **Status:** **Online & Klar**

### 2. ⚡ TLDR Speed-Brief: Daily Digest
* **Lydfil:** `podcast/audio/tldr-briefing-2026-05-21.m4a` (AAC, 128 kbps, streambar)
* **RSS Feed:** `https://viggo-1.github.io/brief/podcast/tldr_podcast.xml`
* **Cover Art:** `https://viggo-1.github.io/brief/podcast/tldr_cover.png` (Vibrant orange/rødt Tech-tema)
* **Status:** **Online & Klar**

### 3. ⏰ Automatisering
* **Morgen-Cron:** Oprettet og aktiv i Antigravity-motoren. Den kører automatisk **hver morgen kl. 05:00 dansk tid (CEST)** for at hente, generere, konvertere og uploade dagens to briefings.

---

## 🛠️ Optimeringer foretaget i denne session

1. **Sikkerhed i Playwright (`src/notebooklm.js`):**
   * Rettede en fejl i Playwright-valg, hvor `isVisible({ timeout })` blev kaldt (hvilket ikke er understøttet i Playwright). Det er nu erstattet med en robust `waitFor({ state: 'visible', timeout: 5000 })` efterfulgt af en fejlsikker `isVisible()`-kontrol.
2. **Udvidet Server-Resiliens:**
   * Øgede den maksimale ventetid (`maxWaitTimeMs`) for NotebookLMs lydgenerering fra **15 to 25 minutter**. Dette sikrer, at pipelines ikke fejler på dage, hvor Googles servere er under høj belastning.
3. **RSS Cover Art integration:**
   * Opdaterede RSS-feeds til at pege direkte på dine lokalt genererede, professionelle branding-covers i stedet for de generiske Unsplash-placeholders.

---

## 🎨 Apple Podcasts: Guide til Design & Brugeroplevelse

Når du har tilføjet dine feeds til **Apple Podcasts Connect** (via [podcastsconnect.apple.com](https://podcastsconnect.apple.com)), har du rige muligheder for at tilpasse udseendet og lytteoplevelsen for at give et 100% premium og skræddersyet udtryk.

Her er et komplet overblik over dine tilpasningsmuligheder:

### 1. Visuel Branding & Grafik
Apple Podcasts bruger dit RSS-feeds coverbillede som det primære designelement, men i Apple Podcasts Connect kan du udvide dette markant:
* **Kanalsider (Channels):** Hvis du samler begge podcasts under én fælles kanal (f.eks. "Viggo's Tech Briefings"), kan du uploade:
  * **Kanal-logo:** Et gennemsigtigt PNG-logo (3000 x 3000px), der placeres elegant over en farvet baggrund.
  * **Banner-grafik (Hero Banner):** Et widescreen-billede (mindst 4000 x 3000px, 16:9 safe zone), som vises øverst på din kanalside på iPhone, iPad og Mac. Dette skaber en fantastisk "wow-effekt" med et professionelt, integreret udseende.
  * **Baggrundsfarve:** Du kan vælge en specifik hex-kode (f.eks. en sleek mørk farve eller dyb natblå), som appen bruger til at tone hele kanalsiden.

### 2. Tekst, Metadata & Struktur
* **HTML & Rich Text Show Notes:** 
  * Apple Podcasts understøtter nu fuldt ud basale HTML-tags i din `<description>` (såsom `<b>`, `<i>`, `<ul>`, `<ol>`, `<li>` og især `<a href="...">`).
  * Du kan bruge dette til at lave klikbare links direkte til de kilder, som Gemini opsummerer (f.eks. direkte links til dagens TLDR Tech- og AI-artikler), samt pæne punktopstillinger.
* **Sæson- og Episodenumre:**
  * RSS-feedet er forberedt til `<itunes:episodeType>`. Du kan indstille episoderne som `full` (almindelige episoder), `trailer` (introduktion) eller `bonus`.
  * Du kan også tildele sæsonnumre for at strukturere dine ugentlige eller månedlige arkiver.

### 3. Brugeroplevelse & Lytte-Indstillinger
* **Automatiske Transskriptioner:**
  * Apple genererer automatisk transskriptioner af dine episoder på sprog som engelsk, spansk, fransk og tysk. Da dine podcasts genereres på engelsk af NotebookLM, vil Apple Podcasts **helt automatisk oprette præcise undertekster** og søgbare transskriptioner inden for få timer efter udgivelse.
  * Lyttere kan trykke på ikonet "Transskription" i nederste venstre hjørne på deres iPhone for at læse med i realtid, søge efter specifikke ord eller trykke på en tekstlinje for at hoppe direkte til det tidspunkt i lyden.
* **Afspilningsrækkefølge:**
  * Da dette er en daglig nyhedspodcast, bør du sikre dig, at din podcasttype i Connect/RSS is sat til `episodic`. Dette sikrer, at Apple Podcasts altid viser og afspiller den **nyeste episode først** for brugeren, frem for at starte fra bunden af arkivet.

### 4. Apple Podcasts Subscriptions (Premium-oplevelse)
Selvom feedsene i dag er private RSS-feeds via GitHub Pages, kan du via Apple Podcasts Connect oprette betalte eller eksklusive abonnementsmuligheder:
* **Eksklusiv adgang:** Lave en abonnementskanal, hvor visse episodeserier (f.eks. de dybe Executive-analyser) kun er tilgængelige for godkendte abonnenter eller medlemmer.
* **Gratis prøveperioder:** Give folk adgang til din TLDR Speed-Brief gratis, men kræve abonnement for det fulde vidensniveau i Executive Briefing.

---

## 🚀 Næste Skridt for dig
Du behøver ikke gøre noget teknisk nu! Alt kører fuldt automatiseret. 

1. **Abonner på feedsene på din iPhone:**
   * **Executive Briefing:** `https://viggo-1.github.io/brief/podcast/podcast.xml`
   * **TLDR Speed-Brief:** `https://viggo-1.github.io/brief/podcast/tldr_podcast.xml`
2. **Kig forbi Apple Podcasts Connect:**
   * Log ind på [podcastsconnect.apple.com](https://podcastsconnect.apple.com) med dit Apple ID.
   * Tilføj de to RSS-adresser som nye podcasts.
   * Upload de to tilhørende custom covers (`executive_cover.png` og `tldr_cover.png`) for at fuldende den premium visuelle oplevelse.
