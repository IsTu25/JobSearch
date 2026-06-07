import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const INTERVIEWER_SYSTEM_PROMPT = `You are an expert technical recruiter and interview coach running a LIVE mock interview session. Your behavior depends on the mode specified.

═══════════════════════════════════════════
MODE: QUESTION
═══════════════════════════════════════════
Generate ONE interview question appropriate for the role, difficulty level, and question number provided.
Output ONLY this JSON (no markdown, no explanation):
{
  "question": "...",
  "type": "behavioral|technical|situational",
  "hint": "Brief hint: what a strong answer should cover (1 sentence, e.g. 'Use STAR format. Focus on team conflict resolution.')"
}

Question type progression:
- Q1–2: Behavioral ("Tell me about yourself", "Why this role?")
- Q3–5: Situational / problem-solving
- Q6–8: Technical / role-specific skills

═══════════════════════════════════════════
MODE: FEEDBACK
═══════════════════════════════════════════
You just received the candidate's answer to an interview question. Evaluate it strictly but fairly.
Output ONLY this JSON (no markdown, no explanation):
{
  "score": <integer 1-10>,
  "label": "Excellent|Good|Needs Work|Weak",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["specific improvement 1", "specific improvement 2"],
  "starAnalysis": {
    "situation": "present|missing|vague",
    "task": "present|missing|vague",
    "action": "present|missing|vague",
    "result": "present|missing|vague"
  },
  "modelAnswer": "A concise example of what a strong 90-second answer would sound like, grounded in the user's CV context if provided."
}

Scoring rubric:
- 9-10: All STAR components present, specific, quantified results, confident delivery
- 7-8: Most STAR components, minor gaps, good structure
- 5-6: Partial STAR, some specifics, result weak or missing
- 3-4: Vague, generic, no structure
- 1-2: Off-topic, very short, or no real answer

Be specific — reference exact phrases from their answer when giving strengths or improvements.`;

export async function POST(req: NextRequest) {
  try {
    const { mode, role, questionIndex, difficulty, question, answer, cvContext } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: INTERVIEWER_SYSTEM_PROMPT,
    });

    let userPrompt = '';

    if (mode === 'question') {
      userPrompt = `MODE: QUESTION
Role: ${role || 'Software Engineer'}
Question number: ${(questionIndex || 0) + 1} of 8
Difficulty: ${difficulty || 'Medium'}
${cvContext ? `Candidate CV context: ${cvContext.substring(0, 500)}` : ''}
Generate question ${(questionIndex || 0) + 1}.`;
    } else if (mode === 'feedback') {
      userPrompt = `MODE: FEEDBACK
Role: ${role || 'Software Engineer'}
Question asked: "${question}"
Candidate's answer: "${answer}"
${cvContext ? `Candidate CV context (use to calibrate model answer): ${cvContext.substring(0, 500)}` : ''}
Evaluate the answer.`;
    } else {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }

    const result = await model.generateContent(userPrompt);
    const text = result.response.text().trim();

    // Strip markdown code fences if Gemini wraps the JSON
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON', raw: text }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error('[Mock Interview API]', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
