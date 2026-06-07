import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const { company, role, location } = await req.json();
    if (!company) return NextResponse.json({ error: 'Company name required' }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are a company research assistant. Provide a concise insider summary for job seekers about this company based on publicly known information.

Company: ${company}
Role being applied for: ${role || 'General'}
Location: ${location || 'Not specified'}

Return ONLY this JSON (no markdown wrapping):
{
  "overview": "2-sentence company overview (size, industry, mission)",
  "culture": "2-3 sentences on work culture, values, employee reviews (reference Glassdoor/Blind reputation if known)",
  "interviewProcess": "What their typical interview process looks like for this role (phone screen, rounds, technical tests, etc.)",
  "salaryRange": "Realistic salary range for this role at this company based on public data (Glassdoor/Levels.fyi/LinkedIn)",
  "proscons": {
    "pros": ["pro 1", "pro 2", "pro 3"],
    "cons": ["con 1", "con 2"]
  },
  "tip": "One specific insider tip for impressing this company in interviews"
}

If the company is unknown or very small, provide realistic estimates based on company size/stage. Be honest and factual.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'Could not parse company data', raw: text }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
