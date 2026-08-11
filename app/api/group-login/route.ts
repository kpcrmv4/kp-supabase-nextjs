import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAnon } from '@/lib/supabase/anon';
import { createGroupSessionToken } from '@/lib/group-session';
import { GROUP_SESSION_COOKIE, GROUP_SESSION_MAX_AGE } from '@/lib/constants';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: { slug?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const slug = typeof body.slug === 'string' ? body.slug : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!slug || !password) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const clientKey = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  const { data, error } = await getSupabaseAnon().rpc('verify_group_password', {
    p_slug: slug, p_password: password, p_client_key: clientKey,
  });
  if (error) {
    console.error('[group-login] rpc failed', error.message);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  const result = data as { ok: boolean; error?: string; group_id?: string; password_version?: number };
  if (!result.ok) {
    if (result.error === 'rate_limited') {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }
    return NextResponse.json({ error: 'invalid' }, { status: 401 });
  }

  // Session cookie must be written onto the response object (skill bug #2).
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    GROUP_SESSION_COOKIE,
    createGroupSessionToken(result.group_id!, result.password_version!, GROUP_SESSION_MAX_AGE),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: GROUP_SESSION_MAX_AGE,
    },
  );
  return response;
}
