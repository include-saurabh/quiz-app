import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Basic in-memory rate limiting (Map to store IP -> Array of request timestamps)
// Note: In Serverless environments, this is per-instance, but serves as a great first line of defense.
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 10;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  
  // Filter out timestamps older than 1 hour
  const recentTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
  
  if (recentTimestamps.length >= MAX_REQUESTS) {
    return true;
  }
  
  recentTimestamps.push(now);
  rateLimitMap.set(ip, recentTimestamps);
  return false;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authorization header check
    const adminKey = req.headers.get('x-admin-key');
    if (!adminKey || adminKey !== process.env.ADMIN_PASSCODE) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Rate limiting check
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'प्रश्नांच्या निर्मितीची मर्यादा संपली आहे. कृपया एका तासानंतर पुन्हा प्रयत्न करा.' }, // Rate limit reached in Marathi
        { status: 429 }
      );
    }

    // 3. Request validation
    const body = await req.json();
    const { topic, referenceText, questionCount } = body;

    if (!topic || !referenceText || !questionCount) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const parsedCount = parseInt(questionCount, 10);
    if (isNaN(parsedCount) || parsedCount < 1 || parsedCount > 20) {
      return NextResponse.json({ error: 'Question count must be between 1 and 20' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured on the server' }, { status: 500 });
    }

    // 4. Call Gemini model with strict JSON schema
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            questions: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  question_text: { type: SchemaType.STRING },
                  options: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: "Exactly 4 options"
                  },
                  correct_option: { type: SchemaType.INTEGER, description: "Index 0 to 3 of the correct answer" },
                  explanation: { type: SchemaType.STRING, description: "Explanation in Marathi in 1-3 sentences" }
                },
                required: ['question_text', 'options', 'correct_option', 'explanation']
              }
            }
          },
          required: ['questions']
        }
      }
    });

    const systemPrompt = `You are an expert Marathi-language educator. Generate multiple-choice quiz questions strictly based on the provided reference text.

RULES:
- All question_text, options, and explanation fields MUST be in Marathi.
- Each question must have exactly 4 options.
- correct_option is the zero-based index (0, 1, 2, or 3) of the correct answer.
- explanation must explain WHY the correct answer is right, in 1-3 sentences in Marathi.
- Do NOT generate questions outside the scope of the reference text.
- Output ONLY a valid JSON object matching the requested schema. No preamble, no markdown fences.`;

    const prompt = `
Topic: ${topic}
Number of questions to generate: ${parsedCount}
Reference Text:
---
${referenceText}
---
${systemPrompt}
`;

    const result = await model.generateContent(prompt);
    const rawText = result.response.text();

    try {
      const parsedData = JSON.parse(rawText);
      
      // Basic sanity check that questions exist
      if (!parsedData.questions || !Array.isArray(parsedData.questions)) {
        throw new Error('Invalid schema format from Gemini');
      }

      // Ensure every question has exactly 4 options
      for (const q of parsedData.questions) {
        if (!q.options || q.options.length !== 4) {
          q.options = q.options ? q.options.slice(0, 4) : [];
          while (q.options.length < 4) {
            q.options.push(`पर्याय ${q.options.length + 1}`);
          }
        }
      }

      return NextResponse.json(parsedData);
    } catch (parseError) {
      console.error('Error parsing JSON from Gemini:', rawText, parseError);
      return NextResponse.json({ error: 'Gemini कडून मिळालेले उत्तर अयोग्य स्वरूपात होते. कृपया पुन्हा प्रयत्न करा.', raw: rawText }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error generating questions:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
