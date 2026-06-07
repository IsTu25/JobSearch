import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SALARY_COACH_SYSTEM_PROMPT = `You are an expert salary negotiation coach with 15 years of experience helping candidates negotiate offers. You have deep knowledge of market rates, negotiation psychology, and compensation structures.

Your role is to:
1. Evaluate the offer the candidate received
2. Research realistic market rates for their role/location
3. Coach them on counteroffers with specific numbers
4. Provide negotiation scripts they can use word-for-word
5. Handle objections from employers

RULES:
- Always give a specific counter-offer number, never just say "negotiate higher"
- Use the user's CV, target role, and experience level to calibrate advice
- Base salary data on realistic market knowledge (Glassdoor/Levels.fyi ranges)
- Provide word-for-word scripts the candidate can say or email
- Be direct and confident — timid advice costs candidates real money
- End every response with a "Script to use:" section with exact wording

Format responses with clear sections:
## 📊 Offer Analysis
## 💰 Market Rate Research  
## 🎯 Recommended Counter
## 📝 Script to Use
## ⚠️ Watch Out For`;

export async function POST(req: NextRequest) {
  try {
    const { message, chatHistory, cvContext, targetRole, currentOffer } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SALARY_COACH_SYSTEM_PROMPT + `\n\n[CANDIDATE CONTEXT]\nTarget Role: ${targetRole || 'Not specified'}\nCurrent Offer Details: ${currentOffer || 'Not specified yet'}\nCV Summary: ${cvContext || 'Not provided'}`,
    });

    const history = (chatHistory || []).slice(-12).map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history });
    const responseStream = await chat.sendMessageStream(message);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of responseStream.stream) {
            controller.enqueue(new TextEncoder().encode(chunk.text()));
          }
          controller.close();
        } catch (err) { controller.error(err); }
      }
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' }
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
