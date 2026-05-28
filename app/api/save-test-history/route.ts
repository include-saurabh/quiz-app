import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, testType, topics, score, totalQuestions, questionResults } = body;

    if (!userId || !topics || score === undefined || !totalQuestions || !questionResults) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    // Insert into Supabase test_history using server client (bypasses RLS)
    const { data, error } = await supabase.from('test_history').insert({
      user_id: userId,
      test_type: testType || 'topic-wise',
      topics,
      score,
      total_questions: totalQuestions,
      question_results: questionResults,
    }).select();

    if (error) {
      console.error('Error inserting test history from server API:', error);
      throw error;
    }

    // Trigger AI insights regeneration asynchronously
    const origin = new URL(req.url).origin;
    fetch(`${origin}/api/insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }).catch(err => console.error('Failed to trigger async insights:', err));

    return NextResponse.json({
      success: true,
      message: 'Test history saved successfully',
      data: data?.[0],
    });
  } catch (error: any) {
    console.error('Save test history route error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
