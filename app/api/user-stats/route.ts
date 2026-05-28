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

    // 1. Fetch test history count and scores (sorted by created_at ascending)
    const { data: testHistory, error: historyError } = await supabase
      .from('test_history')
      .select('score, total_questions, question_results, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (historyError) {
      console.error('Error fetching test history:', historyError);
      throw historyError;
    }

    const totalTests = testHistory ? testHistory.length : 0;
    let averageScore = 0;
    const scoreHistory: { testIndex: number; date: string; percentage: number }[] = [];
    const subjectStats: Record<string, { total: number; correct: number }> = {};

    if (totalTests > 0) {
      const totalPercentage = testHistory.reduce((sum, test, index) => {
        const pct = test.total_questions > 0 ? (test.score / test.total_questions) * 100 : 0;
        
        // Populate score history for line chart
        const dateObj = new Date(test.created_at);
        const formattedDate = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
        scoreHistory.push({
          testIndex: index + 1,
          date: formattedDate,
          percentage: Math.round(pct),
        });

        // Populate subject-wise stats for bar chart
        const results = Array.isArray(test.question_results) ? test.question_results : [];
        results.forEach((qRes: any) => {
          const subj = qRes.subject || 'सामान्य';
          const isCorrect = qRes.is_correct === true;

          if (!subjectStats[subj]) {
            subjectStats[subj] = { total: 0, correct: 0 };
          }
          subjectStats[subj].total += 1;
          if (isCorrect) {
            subjectStats[subj].correct += 1;
          }
        });

        return sum + pct;
      }, 0);
      averageScore = Math.round(totalPercentage / totalTests);
    }

    // Convert subjectStats to list
    const subjectProgress = Object.entries(subjectStats).map(([subject, stats]) => ({
      subject,
      percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      total: stats.total
    }));

    // 2. Fetch user insights
    const { data: userInsight, error: insightError } = await supabase
      .from('user_insights')
      .select('summary_marathi, generated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (insightError) {
      console.error('Error fetching user insights:', insightError);
      throw insightError;
    }

    // 3. Fetch unique subjects and topics from questions table
    const { data: questionsData, error: questionsError } = await supabase
      .from('questions')
      .select('subject, topic');
    
    if (questionsError) {
      console.error('Error fetching questions keys:', questionsError);
      throw questionsError;
    }

    // Group topics under subjects
    const subjectsMap: Record<string, Set<string>> = {};
    (questionsData || []).forEach(q => {
      const subj = q.subject || 'सामान्य';
      const top = q.topic || 'सामान्य';
      if (!subjectsMap[subj]) {
        subjectsMap[subj] = new Set();
      }
      subjectsMap[subj].add(top);
    });

    const structuredSubjects = Object.entries(subjectsMap).map(([subject, topicsSet]) => ({
      subject,
      topics: Array.from(topicsSet),
    }));

    return NextResponse.json({
      totalTests,
      averageScore,
      insights: userInsight ? userInsight.summary_marathi : null,
      subjects: structuredSubjects,
      scoreHistory,
      subjectProgress,
    });
  } catch (err: any) {
    console.error('User stats retrieval error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
