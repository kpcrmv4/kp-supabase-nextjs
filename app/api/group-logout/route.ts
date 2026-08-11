import { NextResponse } from 'next/server';
import { GROUP_SESSION_COOKIE } from '@/lib/constants';

export const runtime = 'nodejs';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(GROUP_SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
