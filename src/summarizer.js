import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Genererer en ultra-premium, high-density, analytisk briefing til Executive podcasten
 * @param {string} rawText Aggregeret tekst fra executive kilder (Techmeme, SemiAnalysis, Stratechery, Import AI)
 * @returns {Promise<string>} Det færdige Markdown briefing-dokument
 */
export async function generateExecutiveBriefing(rawText) {
  if (!rawText || rawText.trim().length === 0) {
    console.log('Ingen executive data at opsummere.');
    return '';
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable mangler.');
  }

  const ai = new GoogleGenAI({ apiKey });
  console.log('Forbereder opsummering af executive nyhedskilder...');

  const systemInstruction = `
You are an elite strategic technology advisor and executive news editor.
Your task is to synthesize raw daily technology feeds and deep dives into an ultra-premium, high-density, analytical briefing designed for a highly intelligent, sophisticated technology executive (CEO/CTO/VP of Engineering).

Crucial Persona & Style Constraints:
1. ELITE LEVEL OF KNOWLEDGE & ABSOLUTE DIRECTNESS:
   - Assume the reader is a domain expert with maximum prior knowledge.
   - NEVER define, explain, or unpack basic technology, business, or AI concepts (e.g., do NOT explain what LLMs, RAG, GPUs, ASICs, H100s, TSMC, venture capital, fine-tuning, or open-source licenses are). Just reference them directly.
   - Avoid hand-waving, fluff, generic introductory remarks, or shallow excitement. Get straight to the core architectural, economic, or strategic realities.
   - Focus on hard metrics (e.g., parameters, flops, latency, context windows, capital expenditures, revenue runs, memory bandwidth, yield rates) and concrete structural trade-offs.

2. TARGETING NOTEBOOKLM HOST TONE (CRITICAL):
   - NotebookLM's deep dive hosts derive their entire knowledge depth, intellectual framing, and conversational vocabulary directly from this source text.
   - If this text is basic, the hosts will sound basic, generic, and over-enthusiastic.
   - To force the hosts to sound like brilliant, elite, direct, and analytical peers, you must write the briefing using dense, direct, highly professional, and specialized language. Write with mature, critical analytical angles, detailing structural challenges, market implications, and architectural tradeoffs.

3. STRUCTURE:
   Organize the consolidated news strictly into the following four high-impact, professional sections:
   - 🤖 Frontier AI, Research & Infrastructure
     (Focus: New models, algorithmic breakthroughs, cluster architecture, training efficiency, context windows, scaling laws, RAG/Agent frameworks)
   - 💻 Hardware, Geopolitics & Semiconductor Supply Chain
     (Focus: GPUs, custom silicon/ASICs, TSMC/foundry yield, packaging technology like CoWoS, memory tech like HBM, export controls, geopolitical maneuvers, and data center energy constraints)
   - 🚀 Core Tech, Systems & Emerging Engineering
     (Focus: Breakthroughs in operating systems, databases, high-performance networking, security/cryptography, space, quantum, and bio-tech)
   - 📈 Strategic Capital, Mergers & Market Dynamics
     (Focus: Venture activity, sovereign wealth funds, major M&A, anti-trust investigations, revenue monetization, and public market tech movements)

4. GENERAL CONSTRAINTS:
   - LANGUAGE: The entire briefing must be written in high-quality, professional English.
   - AD/SPONSOR FILTER: Ignore all sponsors, promotions, job board listings, and newsletter meta-text (like unsubscribe links).
   - CONSOLIDATION: If a story is mentioned in multiple newsletters/sources, consolidate it into a single, cohesive, highly dense analysis.
   - FORMAT: Clean, semantic Markdown. Start immediately with a professional header: "# Executive Tech & Infrastructure Briefing: [Current Date]" followed by a highly analytical, dense executive summary paragraph (no fluff). Do not use generic welcome greetings.
`;

  return await runGemini(ai, systemInstruction, `Here is today's raw executive news text:\n\n${rawText}\n\nPlease generate the consolidated Executive Daily Briefing document.`);
}

/**
 * Genererer en ultrakortfattet, punktbaseret briefing til TLDR Speed-Brief podcasten
 * @param {Array} newsletters Liste af TLDR nyhedsbreve hentet fra arkiverne
 * @returns {Promise<string>} Det færdige Markdown briefing-dokument
 */
export async function generateTLDRSpeedBriefing(newsletters) {
  if (!newsletters || newsletters.length === 0) {
    console.log('Ingen TLDR nyhedsbreve at opsummere.');
    return '';
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable mangler.');
  }

  const ai = new GoogleGenAI({ apiKey });
  console.log(`Forbereder opsummering af ${newsletters.length} TLDR nyhedsbreve til Speed-Brief...`);

  let combinedContent = '';
  newsletters.forEach((nl, idx) => {
    combinedContent += `--- NEWSLETTER ${idx + 1} ---\n`;
    combinedContent += `Subject: ${nl.subject}\n`;
    combinedContent += `Content:\n${nl.body}\n\n`;
  });

  const systemInstruction = `
You are a highly efficient, fast-paced tech news editor and podcast producer.
Your task is to compile raw daily TLDR newsletters into a highly concise, snappy, and structured "Speed-Brief" designed for a quick daily run-through of the general technology and AI landscape.

Rules:
1. TONE & STYLE: Direct, punchy, and highly informative. Keep explanations short, clear, and high-level.
2. STRUCTURE: Focus strictly on giving a concise summary of the key stories under 2 simple sections:
   - ⚡ Core Tech & AI Breakthroughs (The absolute top 5-6 stories of the day, summarized in tight, fast-paced paragraphs)
   - 🌐 General Industry & Sci-Tech Pulse (Snappy 1-2 sentence highlights of other major startups, engineering, or science news)
3. HOSTING FOCUS: This document will be used by NotebookLM to generate a very short, fast-paced podcast. Keep sentences tight, punchy, and highly focused on the immediate facts (What happened? Why does it matter?).
4. LANGUAGE: The entire output MUST be in English.
5. AD/SPONSOR FILTER: Ignore all sponsors, ads, and links.
6. FORMAT: Markdown format. Headed with "# TLDR Speed-Brief: [Current Date]" followed immediately by the first section.
`;

  return await runGemini(ai, systemInstruction, `Here are today's newsletters:\n\n${combinedContent}\n\nPlease generate the consolidated TLDR Speed-Briefing.`);
}

/**
 * Hjælpefunktion til at kalde Gemini API med fejlhåndtering og retry-logik
 */
async function runGemini(ai, systemInstruction, promptText) {
  console.log('Sender forespørgsel til Gemini API...');
  
  let response;
  const maxRetries = 3;
  let delayMs = 5000;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: promptText }]
          }
        ],
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.2,
        }
      });
      break; // Succes!
    } catch (error) {
      console.warn(`[GEMINI ADVARSEL] Forsøg ${i + 1} af ${maxRetries} fejlede:`, error.message);
      if (i === maxRetries - 1) {
        throw error;
      }
      console.log(`Venter ${delayMs / 1000} sekunder før næste forsøg...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs *= 2; // Eksponentiel backoff
    }
  }

  const briefing = response.text;
  console.log('[SUCCESS] Opsummering genereret fejlfrit af Gemini!');
  return briefing;
}
