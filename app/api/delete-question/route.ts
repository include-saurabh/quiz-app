import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { passcode, questionId } = body;

    // 1. Passcode verification
    if (!passcode || passcode !== process.env.ADMIN_PASSCODE) {
      return NextResponse.json({ error: 'Unauthorized. Admin passcode is incorrect.' }, { status: 401 });
    }

    if (!questionId) {
      return NextResponse.json({ error: 'Missing questionId parameter' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    // 2. Perform Delete
    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', questionId);

    if (error) {
      console.error('Error deleting question:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Question deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete question route error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
