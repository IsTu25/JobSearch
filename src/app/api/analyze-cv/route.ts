import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const { cvText, targetRole } = await req.json();

    if (!cvText || !cvText.trim()) {
      return NextResponse.json({ error: 'CV text is required for analysis' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are a world-class professional CV reviewer and technical recruiter.
Analyze the following CV text in the context of the user's target role ("${targetRole || 'Software Engineer'}").

CV Text:
"""
${cvText}
"""

Evaluate the CV and return a comprehensive analysis. Provide your response STRICTLY as a JSON object matching this schema:
{
  "score": 85, // An integer score from 0 to 100 representing how much a hiring manager/AI would "like" or rate this CV.
  "analysis": "A concise paragraph summarizing your evaluation of the CV's professional value, alignment, and formatting.",
  "strengths": [
    "A list of 3-4 key strengths you found in the CV (e.g., strong programming skills, clear structural division, solid educational background)."
  ],
  "gaps": [
    "A list of 3-4 critical areas of improvement or gaps (e.g., missing metrics or numbers, lack of cloud deployment experience, formatting could be tighter)."
  ],
  "suggestions": [
    "A list of 3-4 specific, actionable rewrite tips or structural suggestions that will immediately improve the CV."
  ]
}

Ensure the response is valid JSON and only contains the JSON. Do not wrap in markdown \`\`\`json blocks.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const cleanedText = responseText.replace(/^```json/, '').replace(/```$/, '').trim();
    const analysis = JSON.parse(cleanedText);

    return NextResponse.json({ analysis });
  } catch (error: unknown) {
    console.error('CV analysis error:', error);
    return NextResponse.json({ error: 'CV analysis failed' }, { status: 500 });
  }
}
