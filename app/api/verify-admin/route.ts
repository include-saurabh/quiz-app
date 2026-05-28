import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { passcode } = await req.json();
    if (!passcode) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    if (passcode === process.env.ADMIN_PASSCODE) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
