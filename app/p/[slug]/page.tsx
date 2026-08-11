// หน้า QR ของลูกค้า — ไม่มี loading.tsx บน segment นี้ (ต้องได้สถานะจริง)
import { cookies } from 'next/headers';
import { getSupabaseAnon } from '@/lib/supabase/anon';
import { verifyGroupSessionToken } from '@/lib/group-session';
import { GROUP_SESSION_COOKIE } from '@/lib/constants';
import { PasswordForm } from './password-form';
import { PriceBoard } from '@/components/customer/price-board';
import type { GroupOverview } from '@/lib/customer-types';

export const dynamic = 'force-dynamic';

export default async function GroupPricePage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const session = verifyGroupSessionToken(cookieStore.get(GROUP_SESSION_COOKIE)?.value);

  if (session) {
    // เช็คกับ DB ทุกครั้ง: กลุ่มยัง active และรหัสผ่านยังเป็นเวอร์ชันเดิม
    const { data, error } = await getSupabaseAnon().rpc('get_group_overview', {
      p_group_id: session.gid,
      p_password_version: session.ver,
    });
    if (!error) {
      const overview = data as GroupOverview;
      if (overview.ok) {
        return (
          <PriceBoard
            groupName={overview.group_name}
            publishedAt={overview.published_at}
            items={overview.items}
          />
        );
      }
    } else {
      console.error('[p/slug] overview rpc failed', error.message);
    }
  }

  return <PasswordForm slug={slug} sessionExpired={!!session} />;
}
