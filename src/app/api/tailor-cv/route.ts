import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { sanitizeForAI, sanitizeField } from '@/lib/sanitize';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed } = checkRateLimit(ip, { maxRequests: 10, windowMs: 60_000 });
  if (!allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  try {
    const body = await req.json();
    const cvText = sanitizeForAI(body.cvText || '', 3000);
    const jobDescription = sanitizeForAI(body.jobDescription || '', 2000);
    const jobTitle = sanitizeField(body.jobTitle || '', 100);
    const company = sanitizeField(body.company || '', 100);

    if (!cvText || !jobDescription) {
      return NextResponse.json({ error: 'CV text and job description are required.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are an expert CV consultant. Tailor this candidate's CV for the specific job without fabricating experience.

RULES:
- Only use existing information from the CV — never invent experience
- Rewrite the Summary to directly address the JD requirements
- Reorder/rephrase Skills to front-load the most relevant ones
- Add 1-2 relevant action verbs or quantifiers if they can be inferred from existing CV content
- Mirror keywords from the JD naturally

Job Title: ${jobTitle} at ${company}
Job Description:
${jobDescription}

Original CV:
${cvText}

Return ONLY this JSON:
{
  "tailoredSummary": "Rewritten professional summary (3-4 sentences, mirrors JD keywords)",
  "tailoredSkills": "Reordered skills line, most relevant first",
  "keywordsAdded": ["keyword1", "keyword2", "keyword3"],
  "changes": ["Change 1 description", "Change 2 description", "Change 3 description"]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

    let parsed;
    try { parsed = JSON.parse(cleaned); }
    catch { return NextResponse.json({ error: 'Could not parse tailoring result.' }, { status: 500 }); }

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
