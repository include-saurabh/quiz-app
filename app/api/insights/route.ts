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

    // 2. Aggregate performance by topic
    const topicStats: Record<string, { total: number; correct: number }> = {};

    history.forEach((test) => {
      const results = Array.isArray(test.question_results) ? test.question_results : [];
      results.forEach((qRes: any) => {
        const topic = qRes.topic || 'सामान्य';
        const isCorrect = qRes.is_correct === true;

        if (!topicStats[topic]) {
          topicStats[topic] = { total: 0, correct: 0 };
        }
        topicStats[topic].total += 1;
        if (isCorrect) {
          topicStats[topic].correct += 1;
        }
      });
    });

    // Simplify stats for prompt context (calculate accuracy rates)
    const performanceSummary = Object.entries(topicStats).map(([topic, stats]) => {
      const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
      return {
        topic,
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

    const prompt = `You are an educational assistant. Based on the following quiz performance data for a student, identify their 2-3 weakest topics and provide a brief, encouraging summary in Marathi.

Performance Data (JSON):
${performanceJsonStr}

Respond ONLY in Marathi in 2-3 sentences. Be specific about topics and encouraging in tone.`;

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
