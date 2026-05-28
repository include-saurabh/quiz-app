import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { passcode } = body;

    // 1. Passcode verification
    if (!passcode || passcode !== process.env.ADMIN_PASSCODE) {
      return NextResponse.json({ error: 'Unauthorized. Admin passcode is incorrect.' }, { status: 401 });
    }

    const supabase = getSupabaseServer();

    // 2. Fetch all test history records
    const { data, error } = await supabase
      .from('test_history')
      .select('id, user_id, score, total_questions, test_type, topics, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching admin test history:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      testHistory: data || [],
    });
  } catch (error: any) {
    console.error('Admin test history route error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
