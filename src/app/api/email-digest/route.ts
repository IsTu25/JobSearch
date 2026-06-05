import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed } = checkRateLimit(ip, { maxRequests: 5, windowMs: 60_000 });
  if (!allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  try {
    const body = await req.json();
    const email = body.email || 'guest@chakrirbazar.com';
    const streak = body.streak || 0;
    const applications = body.applications || [];
    const goals = body.goals || [];
    const targetRole = body.targetRole || 'Software Engineer';

    // Compile active list of applications in interview phase
    const interviewing = applications.filter((a: any) => a.status === 'interviewing');
    const offers = applications.filter((a: any) => a.status === 'offer');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are a helpful career advisor writing a weekly recap email digest to a candidate.
Create a supportive, highly structured weekly digest email in HTML format.

Candidate Context:
- Email: ${email}
- Target Role: ${targetRole}
- Active Streak: ${streak} days
- Applications Count: ${applications.length} total
- Interviewing: ${interviewing.length} active
- Offers: ${offers.length} received
- Pending Goals: ${goals.filter((g: any) => !g.done).length}

Format guidelines:
- Return ONLY valid HTML inside a div wrapper (no markdown wrappers, no backticks, no \`\`\`html)
- Style inline with professional dark mode or clean minimalist styling
- Include a section for "Weekly Highlight"
- Suggest 2 actionable next-steps for the candidate based on their application stats

Start directly with a styled email template wrapper.`;

    const result = await model.generateContent(prompt);
    const html = result.response.text().trim()
      .replace(/^```html\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    return NextResponse.json({ success: true, html, sentTo: email });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
