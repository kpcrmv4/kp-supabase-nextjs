import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAnon } from '@/lib/supabase/anon';
import { verifyGroupSessionToken } from '@/lib/group-session';
import { GROUP_SESSION_COOKIE } from '@/lib/constants';
import type { PriceHistory } from '@/lib/customer-types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = verifyGroupSessionToken(req.cookies.get(GROUP_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const productId = req.nextUrl.searchParams.get('product_id');
  const tierId = req.nextUrl.searchParams.get('tier_id');
  if (!productId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const { data, error } = await getSupabaseAnon().rpc('get_price_history', {
    p_group_id: session.gid,
    p_password_version: session.ver,
    p_product_id: productId,
    p_tier_id: tierId ?? undefined,
  });
  if (error) {
    console.error('[price-history] rpc failed', error.message);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
  const result = data as PriceHistory;
  if (!result.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(result);
}
