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
    const jobTitle = sanitizeField(body.jobTitle || '', 100);
    const company = sanitizeField(body.company || '', 100);
    const jobDescription = sanitizeForAI(body.jobDescription || '', 2000);
    const cvText = sanitizeForAI(body.cvText || '', 2000);
    const targetRole = sanitizeField(body.targetRole || '', 100);

    if (!jobDescription || !cvText) {
      return NextResponse.json({ error: 'Job description and CV text are required.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are an expert cover letter writer. Write a compelling, personalized cover letter for this job application.

CRITICAL RULES:
- NEVER use "I am a passionate professional" or generic openers
- Reference 2-3 SPECIFIC items from the CV: real project names, real companies, real numbers
- Mirror 3+ keywords naturally from the job description
- Max 3 tight paragraphs: Hook → Proof → Ask
- Total word count: 200-280 words

Job Title: ${jobTitle}
Company: ${company}
Job Description:
${jobDescription}

Candidate's CV:
${cvText}

Target Role Context: ${targetRole}

Return ONLY the cover letter text (no JSON, no markdown headers). Start directly with "Dear Hiring Manager," or a personalized opener.`;

    const result = await model.generateContent(prompt);
    const coverLetter = result.response.text().trim();

    return NextResponse.json({ coverLetter, wordCount: coverLetter.split(/\s+/).length });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
