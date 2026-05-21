import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Samler og opsummerer nyhedsbreve ved brug af Gemini API
 * @param {Array} newsletters Liste af nyhedsbreve hentet fra Gmail
 * @returns {Promise<string>} Det færdige Markdown briefing-dokument
 */
export async function generateBriefing(newsletters) {
  if (!newsletters || newsletters.length === 0) {
    console.log('Ingen nyhedsbreve at opsummere.');
    return '';
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable mangler.');
  }

  // Initialiser det nye Google GenAI SDK
  const ai = new GoogleGenAI({ apiKey });

  console.log(`Forbereder opsummering af ${newsletters.length} nyhedsbreve...`);

  // Saml alle nyhedsbreve til én tekstblok
  let combinedContent = '';
  newsletters.forEach((nl, idx) => {
    combinedContent += `--- NEWSLETTER ${idx + 1} ---\n`;
    combinedContent += `Subject: ${nl.subject}\n`;
    combinedContent += `From: ${nl.from}\n`;
    combinedContent += `Date: ${nl.date}\n`;
    combinedContent += `Content:\n${nl.body}\n\n`;
  });

  const systemInstruction = `
You are an expert executive news editor and podcast curator.
Your task is to read raw daily email newsletters (specifically TLDR newsletters) and compile them into a single, cohesive, premium Daily Briefing document.

Strictly adhere to the following rules:
1. LANGUAGE: The entire output MUST be in English.
2. FILTER ADS: Strictly ignore all sponsors, advertisements, job board postings, promotional offers, and links to unsubscribe or buy merch. Extract only the actual editorial news.
3. CONSOLIDATE & DUPLICATE CHECK: If the same news story is mentioned in multiple newsletters, consolidate them into a single comprehensive write-up.
4. STRUCTURE: Organize the news into logical, high-impact sections, for example:
   - 🤖 Artificial Intelligence & Machine Learning
   - 💻 Tech News & Software Development
   - 🚀 Space & Science
   - 📈 Startups & Business
5. WRITING STYLE:
   - Write in a highly engaging, professional, yet conversational tone.
   - Use clear narrative paragraphs rather than dry, short bullet points.
   - Make the transitions between stories smooth and natural.
   - This document will be uploaded to NotebookLM to generate a 2-host audio podcast. Write in a way that provides rich context, interesting angles, and clear explanations so the podcast hosts have fantastic material to banter and discuss!
6. FORMAT: Output clean, beautifully formatted Markdown. Start with a prominent header: "# Daily Tech Briefing: [Current Date]" followed by a short editorial introduction.
`;

  console.log('Sender data til Gemini API...');
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Here are today's newsletters:\n\n${combinedContent}\n\nPlease generate the consolidated Daily Briefing document.`
          }
        ]
      }
    ],
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.2, // Lavere temp for mere præcis og konsistent formatering
    }
  });

  const briefing = response.text;
  console.log('[SUCCESS] Opsummering genereret fejlfrit af Gemini!');
  return briefing;
}
