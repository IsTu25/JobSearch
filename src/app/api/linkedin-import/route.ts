import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const { linkedinText } = await req.json();
    if (!linkedinText || linkedinText.trim().length < 30) {
      return NextResponse.json({ error: 'Please paste more LinkedIn content (at least a few lines).' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are a CV parsing assistant. A user pasted their LinkedIn profile text. Extract structured information and format it as a proper CV text document AND return structured chunks.

LinkedIn text:
"""
${linkedinText.substring(0, 3000)}
"""

Return ONLY this JSON (no markdown wrapping):
{
  "name": "extracted full name or empty string",
  "email": "extracted email or empty string",
  "cvText": "Full formatted CV text using their LinkedIn data, with clear sections: SUMMARY, EXPERIENCE, EDUCATION, SKILLS, PROJECTS",
  "chunks": [
    { "section": "Summary", "content": "..." },
    { "section": "Experience", "content": "..." },
    { "section": "Education", "content": "..." },
    { "section": "Skills", "content": "..." }
  ],
  "targetRole": "most likely target role based on their experience"
}

Make the cvText professional and complete. Use all available information from the LinkedIn text.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'Could not parse LinkedIn data', raw: text }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
