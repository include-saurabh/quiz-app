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
    const { data: testData, error: testError } = await supabase
      .from('test_history')
      .select('id, user_id, score, total_questions, test_type, topics, created_at')
      .order('created_at', { ascending: false });

    if (testError) {
      console.error('Error fetching admin test history:', testError);
      throw testError;
    }

    // 3. Fetch user mappings to map UUID user_id to user login_id
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, login_id');

    const userMap: Record<string, string> = {};
    if (!usersError && usersData) {
      usersData.forEach((u: any) => {
        userMap[u.id] = u.login_id;
      });
    }

    const testHistoryMapped = (testData || []).map((item: any) => ({
      ...item,
      login_id: userMap[item.user_id] || item.user_id,
    }));

    return NextResponse.json({
      success: true,
      testHistory: testHistoryMapped,
    });
  } catch (error: any) {
    console.error('Admin test history route error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
