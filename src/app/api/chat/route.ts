import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CAREER_PILOT_SYSTEM_PROMPT, buildContextPrompt } from '@/lib/prompts';
import { CVChunk } from '@/lib/types';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { sanitizeForAI, sanitizeField } from '@/lib/sanitize';

export async function POST(req: NextRequest) {
  // Rate limit: 20 requests/minute per IP
  const ip = getClientIp(req);
  const { allowed, remaining } = checkRateLimit(ip, { maxRequests: 20, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, {
      status: 429, headers: { 'X-RateLimit-Remaining': '0' }
    });
  }

  try {
    const body = await req.json();
    const message = sanitizeForAI(body.message || '', 1000);
    const profileSummary = sanitizeField(body.profileSummary || '', 400);
    const cvChunks: CVChunk[] = body.cvChunks || [];
    const chatHistory: { role: string; content: string }[] = body.chatHistory || [];


    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key (GEMINI_API_KEY) not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    let selectedChunks: CVChunk[] = [];

    const calculateCosine = (vecA: number[], vecB: number[]) => {
      if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) return 0;
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
      }
      if (normA === 0 || normB === 0) return 0;
      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    };

    if (cvChunks && cvChunks.length > 0) {
      try {
        const embedModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
        const embedResult = await embedModel.embedContent(message);
        const queryEmbedding = embedResult.embedding.values;

        const scoredChunks = cvChunks.map((chunk: CVChunk) => {
          const score = calculateCosine(queryEmbedding, chunk.embedding || []);
          return { chunk, score };
        });

        scoredChunks.sort((a: { score: number }, b: { score: number }) => b.score - a.score);
        selectedChunks = scoredChunks.slice(0, 3).map((item: { chunk: CVChunk }) => item.chunk);

        console.log(`[RAG Engine] Selected top chunks for message: "${message.substring(0, 40)}..."`);
        selectedChunks.forEach((c, idx) => {
          console.log(` - Chunk ${idx + 1}: ${c.section} (Similarity: ${scoredChunks[idx].score.toFixed(4)})`);
        });
      } catch (err) {
        console.error('[RAG Engine] Embedding search failed, falling back:', err);
        selectedChunks = cvChunks.slice(0, 3);
      }
    }

    const contextPrompt = buildContextPrompt(selectedChunks, profileSummary || 'No profile data yet');
    const systemPrompt = CAREER_PILOT_SYSTEM_PROMPT + '\n\n' + contextPrompt;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    });

    const history = (chatHistory || []).slice(-10).map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history });
    const responseStream = await chat.sendMessageStream(message);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of responseStream.stream) {
            const text = chunk.text();
            controller.enqueue(new TextEncoder().encode(text));
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });
  } catch (error: unknown) {
    console.error('Chat API error:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
