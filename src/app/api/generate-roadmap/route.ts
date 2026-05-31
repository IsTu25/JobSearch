import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const { targetRole, months, cvText } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are a world-class career mentor and tech lead.
Build a personalized, highly structured learning roadmap of exactly ${months} months to help a user transition into the role of: "${targetRole}".

Use the user's CV information below to understand their existing skills. IDENTIFY gaps and focus on the skills they do not yet have. Skip topics they already know.

User's CV text:
"""
${cvText || 'No CV uploaded yet.'}
"""

Return your response strictly in the following JSON format. Make sure you generate 3-4 topics per week. Each topic should have a clear learning task, expected hours, and specific free/high-quality resources (Coursera, Udemy, YouTube, official docs).

Strict JSON Schema:
{
  "roadmap": [
    {
      "title": "Month 1 — [Month Title]",
      "milestone": "A concrete project or deliverable that the user must build at the end of this month.",
      "weeks": [
        {
          "title": "Week 1",
          "topics": [
            {
              "id": "m1w1t1", // unique string ID format: m[month_num]w[week_num]t[topic_num]
              "text": "Topic learning task (e.g. Master React state hooks and side effects)",
              "hours": "8-10 hrs",
              "resource": "Official React Hooks documentation & Academind React YouTube playlist"
            }
          ]
        }
      ]
    }
  ]
}

Only return raw JSON. Do not wrap in markdown \`\`\`json blocks. Ensure the response is perfectly formatted JSON.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const cleanedText = responseText.replace(/^```json/, '').replace(/```$/, '').trim();
    
    let parsed;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini response as JSON:', responseText, parseErr);
      // Fallback simple roadmap if JSON parsing fails
      parsed = {
        roadmap: [
          {
            title: 'Month 1 — Foundational Prep',
            milestone: 'Complete primary courses and setup local development environment',
            weeks: [
              {
                title: 'Week 1',
                topics: [
                  {
                    id: 'm1w1t1',
                    text: `Introduction to ${targetRole} fundamentals`,
                    hours: '10 hrs',
                    resource: 'Google Search & YouTube guides',
                    completed: false
                  }
                ]
              }
            ]
          }
        ]
      };
    }

    // Set default completed: false for all topics
    if (parsed.roadmap && Array.isArray(parsed.roadmap)) {
      parsed.roadmap.forEach((month: any) => {
        if (month.weeks && Array.isArray(month.weeks)) {
          month.weeks.forEach((week: any) => {
            if (week.topics && Array.isArray(week.topics)) {
              week.topics.forEach((topic: any) => {
                topic.completed = false;
              });
            }
          });
        }
      });
    }

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error('Roadmap generation error:', error);
    return NextResponse.json({ error: 'Failed to generate roadmap' }, { status: 500 });
  }
}
