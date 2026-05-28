import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { passcode, questions } = body;

    // 1. Passcode verification
    if (!passcode || passcode !== process.env.ADMIN_PASSCODE) {
      return NextResponse.json({ error: 'Unauthorized. Admin passcode is incorrect.' }, { status: 401 });
    }

    // 2. Questions validation
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'No questions provided' }, { status: 400 });
    }

    // Validate the schema for each question
    for (const q of questions) {
      if (!q.subject || !q.topic || !q.question_text || !Array.isArray(q.options) || q.options.length !== 4 || typeof q.correct_option !== 'number' || !q.explanation) {
        return NextResponse.json({ 
          error: 'Invalid question format. Each question must contain: subject, topic, question_text, explanation, correct_option (0-3), and exactly 4 options.' 
        }, { status: 400 });
      }
    }

    const supabase = getSupabaseServer();

    // 3. Bulk Insert
    const insertData = questions.map(q => ({
      subject: q.subject.trim(),
      topic: q.topic.trim(),
      question_text: q.question_text.trim(),
      options: q.options.map((opt: string) => opt.trim()),
      correct_option: q.correct_option,
      explanation: q.explanation.trim(),
      image_url: q.image_url || null,
    }));

    const { data, error } = await supabase
      .from('questions')
      .insert(insertData)
      .select();

    if (error) {
      console.error('Error bulk inserting questions:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      count: data.length,
    });
  } catch (error: any) {
    console.error('Save questions route error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
