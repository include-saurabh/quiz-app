import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    // 1. Fetch all test history records for this user
    const { data: history, error: historyError } = await supabase
      .from('test_history')
      .select('question_results')
      .eq('user_id', userId);

    if (historyError) throw historyError;

    if (!history || history.length === 0) {
      return NextResponse.json({ message: 'No test history found. Skipping analysis.' });
    }

    // 2. Aggregate performance by subject and topic
    const statsMap: Record<string, { subject: string; topic: string; total: number; correct: number }> = {};

    history.forEach((test) => {
      const results = Array.isArray(test.question_results) ? test.question_results : [];
      results.forEach((qRes: any) => {
        const topic = qRes.topic || 'सामान्य';
        const subject = qRes.subject || 'सामान्य';
        const isCorrect = qRes.is_correct === true;
        const key = `${subject} - ${topic}`;

        if (!statsMap[key]) {
          statsMap[key] = { subject, topic, total: 0, correct: 0 };
        }
        statsMap[key].total += 1;
        if (isCorrect) {
          statsMap[key].correct += 1;
        }
      });
    });

    // Simplify stats for prompt context (calculate accuracy rates)
    const performanceSummary = Object.values(statsMap).map((stats) => {
      const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
      return {
        subject: stats.subject,
        topic: stats.topic,
        attempts: stats.total,
        correct: stats.correct,
        accuracy_percentage: `${pct}%`,
      };
    });

    if (performanceSummary.length === 0) {
      return NextResponse.json({ message: 'No questions answered yet. Skipping analysis.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured on the server' }, { status: 500 });
    }

    // 3. Request Gemini model for weak-topic summary in Marathi
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const performanceJsonStr = JSON.stringify(performanceSummary, null, 2);

    const prompt = `You are an educational assistant for MAHATET (Maharashtra Teacher Eligibility Test). 
Based on the following student performance data (which includes subject, topic, and accuracy), identify their weakest subjects and topics, and provide a brief performance summary and specific improvement suggestions in Marathi.

Performance Data (JSON format):
${performanceJsonStr}

Please structure your response in Marathi, and do the following:
1. Summarize their overall weak areas, referring to the specific subjects and topics.
2. Give clear, actionable advice/suggestions on how they can improve in these subjects and topics.
3. Keep the tone encouraging and professional.
4. Keep the total response concise (around 3 to 4 sentences).`;

    const result = await model.generateContent(prompt);
    const summaryMarathi = result.response.text().trim();

    if (!summaryMarathi) {
      throw new Error('Gemini returned an empty insights response.');
    }

    // 4. Cache the insights into user_insights (upsert on user_id)
    const { data: upsertData, error: upsertError } = await supabase
      .from('user_insights')
      .upsert(
        {
          user_id: userId,
          summary_marathi: summaryMarathi,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select();

    if (upsertError) throw upsertError;

    return NextResponse.json({
      success: true,
      insights: summaryMarathi,
    });
  } catch (error: any) {
    console.error('Error generating weak topic summary:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
