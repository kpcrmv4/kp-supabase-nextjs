import Link from 'next/link';
import { Banknote, CalendarClock, Package, QrCode, Users } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/format';

export default async function AdminDashboard() {
  const supabase = await getSupabaseServer();

  const [groups, products, scheduled, lastPublished] = await Promise.all([
    supabase.from('customer_groups').select('id', { count: 'exact', head: true }),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('price_lists').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
    supabase.from('price_lists').select('published_at, customer_groups(name)')
      .eq('status', 'published').order('published_at', { ascending: false }).range(0, 0),
  ]);

  const latest = lastPublished.data?.[0];

  const stats = [
    { label: 'กลุ่มลูกค้า', value: groups.count ?? 0, icon: Users, href: '/admin/groups' },
    { label: 'สินค้าที่รับซื้อ', value: products.count ?? 0, icon: Package, href: '/admin/products' },
    { label: 'รอเผยแพร่ตามเวลา', value: scheduled.count ?? 0, icon: CalendarClock, href: '/admin/history' },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-5 text-xl font-semibold">ภาพรวม</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="rounded-card bg-card p-4 hover:shadow-pop">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-brand/10 p-2.5 text-brand"><Icon size={20} /></span>
              <div>
                <p className="text-2xl font-semibold">{value.toLocaleString('th-TH')}</p>
                <p className="text-sm text-muted">{label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-4 rounded-card bg-card p-4">
        <p className="text-sm text-muted">เผยแพร่ราคาล่าสุด</p>
        <p className="mt-1 font-medium">
          {latest
            ? `${(latest.customer_groups as { name: string } | null)?.name ?? '-'} · ${formatDateTime(latest.published_at)}`
            : 'ยังไม่เคยเผยแพร่ราคา'}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href="/admin/pricing" className="flex items-center gap-3 rounded-card bg-brand p-4 text-white hover:opacity-95">
          <Banknote size={22} />
          <div>
            <p className="font-medium">ตั้งราคาวันนี้</p>
            <p className="text-sm text-white/75">บันทึกร่าง เผยแพร่ทันที หรือตั้งเวลา</p>
          </div>
        </Link>
        <Link href="/admin/groups" className="flex items-center gap-3 rounded-card bg-card p-4 hover:shadow-pop">
          <QrCode size={22} className="text-brand" />
          <div>
            <p className="font-medium">QR สำหรับลูกค้า</p>
            <p className="text-sm text-muted">เปิดจากหน้ากลุ่มลูกค้าแต่ละกลุ่ม</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
