import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, testId } = body;

    // 1. Validation
    if (!userId || !testId) {
      return NextResponse.json({ error: 'Missing userId or testId parameters' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    // 2. Perform Delete (matching both testId and userId for safety)
    const { data, error } = await supabase
      .from('test_history')
      .delete()
      .eq('id', testId)
      .eq('user_id', userId)
      .select();

    if (error) {
      console.error('Error deleting test history record:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Test record not found or unauthorized' }, { status: 404 });
    }

    // 3. Asynchronously trigger AI insights regeneration to reflect the deleted test
    // Find the base URL dynamically
    const origin = new URL(req.url).origin;
    fetch(`${origin}/api/insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }).catch(err => console.error('Failed to trigger async insights on delete:', err));

    return NextResponse.json({
      success: true,
      message: 'Test history record deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete test history route error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
