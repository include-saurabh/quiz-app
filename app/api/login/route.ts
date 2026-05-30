import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { loginId } = body;

    // Validate login ID
    if (!loginId || typeof loginId !== 'string' || loginId.trim().length < 3) {
      return NextResponse.json(
        { error: 'लॉगिन आयडी कमीत कमी ३ अक्षरांचा असावा.' },
        { status: 400 }
      );
    }

    const cleanLoginId = loginId.trim().toLowerCase();
    const supabase = getSupabaseServer();

    // 1. Check if user already exists
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, login_id')
      .eq('login_id', cleanLoginId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching user on login:', fetchError);
      throw fetchError;
    }

    // 2. If exists, return user id
    if (user) {
      return NextResponse.json({
        success: true,
        userId: user.id,
        loginId: user.login_id,
        message: 'यशस्वी लॉगिन!',
      });
    }

    // 3. If not exists, insert new user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({ login_id: cleanLoginId })
      .select('id, login_id')
      .single();

    if (insertError) {
      console.error('Error registering new user:', insertError);
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      userId: newUser.id,
      loginId: newUser.login_id,
      message: 'नवीन खाते यशस्वीरित्या तयार केले!',
    });

  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { error: error.message || 'सर्व्हर एरर. कृपया पुन्हा प्रयत्न करा.' },
      { status: 500 }
    );
  }
}
