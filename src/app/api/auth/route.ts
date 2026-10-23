import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isAuthRequired, checkAuth, validatePassword, generateAuthCookieValue, COOKIE_NAME } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET: Check auth status
export async function GET() {
  const required = isAuthRequired();
  const authenticated = checkAuth();

  return NextResponse.json({
    required,
    authenticated,
  });
}

// POST: Log in with password
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!isAuthRequired()) {
      return NextResponse.json({ success: true, message: 'Password tidak diaktifkan' });
    }

    if (!password || !validatePassword(password)) {
      return NextResponse.json(
        { error: 'Password salah. Periksa kembali password kantor kamu.' },
        { status: 401 }
      );
    }

    const token = generateAuthCookieValue();
    const cookieStore = cookies();

    // 30 days cookie session
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({
      success: true,
      message: 'Autentikasi berhasil',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Log out
export async function DELETE() {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ success: true, message: 'Berhasil keluar' });
}
