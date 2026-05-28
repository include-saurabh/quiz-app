import { NextRequest, NextResponse } from 'next/server';

export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === '/api/generate-questions') {
    const adminKey = req.headers.get('x-admin-key');
    const expectedPasscode = process.env.ADMIN_PASSCODE;

    if (!adminKey || adminKey !== expectedPasscode) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin passcode required.' },
        { status: 401 }
      );
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
