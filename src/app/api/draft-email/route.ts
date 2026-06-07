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
    const company = sanitizeField(body.company || '', 100);
    const role = sanitizeField(body.role || '', 100);
    const cvText = sanitizeForAI(body.cvText || '', 1500);

    if (!company || !role) {
      return NextResponse.json({ error: 'Company and role required.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are a professional job application email writer. Write a concise, personalized cold application email.

RULES:
- Subject line should be specific and stand out
- Opening: one sentence that shows genuine interest in the specific company
- Body: 2-3 bullet achievements from the CV that are most relevant to the role
- CTA: clear ask for a conversation, not "I hope to hear from you"
- Total: under 200 words, no fluff
- Tone: confident professional, not desperate

Company: ${company}
Role applied for: ${role}
Candidate's CV highlights: ${cvText}

Return ONLY this JSON:
{
  "subject": "Email subject line",
  "body": "Full email body text (use \\n for line breaks)"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

    let parsed;
    try { parsed = JSON.parse(cleaned); }
    catch { return NextResponse.json({ error: 'Could not generate email.' }, { status: 500 }); }

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
