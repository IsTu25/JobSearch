import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (err) {
    console.error('[Gemini Embedding] Failed:', err);
    return [];
  }
}

function chunkCV(text: string): { section: string; content: string }[] {
  const sections = [
    { label: 'Summary', patterns: [/summary|objective|about|profile/i] },
    { label: 'Experience', patterns: [/experience|work|employment|career/i] },
    { label: 'Education', patterns: [/education|academic|degree|university|school/i] },
    { label: 'Skills', patterns: [/skills|technologies|tools|competenc/i] },
    { label: 'Projects', patterns: [/projects|portfolio|work samples/i] },
    { label: 'Certifications', patterns: [/certif|license|credential|awards/i] },
  ];

  const lines = text.split('\n');
  const chunks: { section: string; content: string }[] = [];
  let currentSection = 'General';
  let currentContent: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let matched = false;
    for (const sec of sections) {
      if (sec.patterns.some(p => p.test(trimmed)) && trimmed.length < 60) {
        if (currentContent.length > 0) {
          chunks.push({ section: currentSection, content: currentContent.join('\n') });
        }
        currentSection = sec.label;
        currentContent = [];
        matched = true;
        break;
      }
    }
    if (!matched) currentContent.push(trimmed);
  }

  if (currentContent.length > 0) {
    chunks.push({ section: currentSection, content: currentContent.join('\n') });
  }

  return chunks.length > 0 ? chunks : [{ section: 'General', content: text }];
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('cv') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const fileName = file.name;
    let text = '';

    if (fileName.endsWith('.pdf')) {
      const buffer = Buffer.from(await file.arrayBuffer());
      // @ts-ignore
      const pdfParseModule = (await import('pdf-parse')) as any;
      const pdfParse = pdfParseModule.default || pdfParseModule;
      const parsed = await pdfParse(buffer);
      text = parsed.text;
    } else if (fileName.endsWith('.docx')) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (fileName.endsWith('.txt')) {
      text = await file.text();
    } else {
      return NextResponse.json({ error: 'Upload PDF, DOCX, or TXT file.' }, { status: 400 });
    }

    const rawChunks = chunkCV(text);
    const apiKey = process.env.GEMINI_API_KEY || '';
    const embeddedChunks = await Promise.all(
      rawChunks.map(async (chunk) => {
        const embedding = apiKey ? await getEmbedding(chunk.content, apiKey) : [];
        return {
          ...chunk,
          embedding,
        };
      })
    );

    // Extract name heuristic: first non-empty line
    const firstLine = text.split('\n').find(l => l.trim().length > 2)?.trim() || '';
    const nameGuess = firstLine.length < 50 ? firstLine : '';

    return NextResponse.json({
      text,
      chunks: embeddedChunks,
      fileName,
      nameGuess,
    });
  } catch (error: unknown) {
    console.error('CV parse error:', error);
    const errMsg = error instanceof Error ? error.message : 'Failed to parse CV';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
