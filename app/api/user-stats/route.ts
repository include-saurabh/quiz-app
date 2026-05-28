import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id parameter' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    // 1. Fetch test history count and scores
    const { data: testHistory, error: historyError } = await supabase
      .from('test_history')
      .select('score, total_questions')
      .eq('user_id', userId);

    if (historyError) {
      console.error('Error fetching test history:', historyError);
      throw historyError;
    }

    const totalTests = testHistory ? testHistory.length : 0;
    let averageScore = 0;

    if (totalTests > 0) {
      const totalPercentage = testHistory.reduce((sum, test) => {
        const pct = test.total_questions > 0 ? (test.score / test.total_questions) * 100 : 0;
        return sum + pct;
      }, 0);
      averageScore = Math.round(totalPercentage / totalTests);
    }

    // 2. Fetch user insights (stored Gemini analysis)
    const { data: userInsight, error: insightError } = await supabase
      .from('user_insights')
      .select('summary_marathi, generated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (insightError) {
      console.error('Error fetching user insights:', insightError);
      throw insightError;
    }

    // 3. Fetch unique topics from questions table to populate the selection on the dashboard
    // Note: Since questions table has public read, we can query it safely.
    const { data: topicsData, error: topicsError } = await supabase
      .from('questions')
      .select('topic');
    
    if (topicsError) {
      console.error('Error fetching topics:', topicsError);
      throw topicsError;
    }

    const uniqueTopics = Array.from(new Set((topicsData || []).map(q => q.topic))).filter(Boolean);

    return NextResponse.json({
      totalTests,
      averageScore,
      insights: userInsight ? userInsight.summary_marathi : null,
      topics: uniqueTopics,
    });
  } catch (err: any) {
    console.error('User stats retrieval error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
