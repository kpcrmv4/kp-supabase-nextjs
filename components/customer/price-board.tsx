'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, LogOut, Minus, Search, Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { TrendBadge, trendOf } from '@/components/price-trend';
import { formatDateTime, formatPrice } from '@/lib/format';
import { SHOP_NAME } from '@/lib/constants';
import type { OverviewItem, PriceHistory } from '@/lib/customer-types';

export function PriceBoard({
  groupName, publishedAt, items,
}: {
  groupName: string;
  publishedAt: string | null;
  items: OverviewItem[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [detail, setDetail] = useState<OverviewItem | null>(null);

  const categories = useMemo(
    () => [...new Map(items.map((i) => [i.category_name, i.category_sort])).entries()]
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], 'th'))
      .map(([name]) => name),
    [items],
  );

  const summary = useMemo(() => {
    const up = items.filter((i) => trendOf(i.price, i.prev_price) === 'up');
    const down = items.filter((i) => trendOf(i.price, i.prev_price) === 'down');
    const flat = items.length - up.length - down.length;
    const movers = [...up, ...down]
      .map((i) => ({ item: i, diff: i.price - (i.prev_price as number) }))
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 3);
    return { up: up.length, down: down.length, flat, movers };
  }, [items]);

  const filtered = useMemo(
    () => items.filter((i) =>
      (!category || i.category_name === category)
      && (!search.trim() || i.product_name.toLowerCase().includes(search.trim().toLowerCase()))),
    [items, search, category],
  );

  async function exit() {
    await fetch('/api/group-logout', { method: 'POST' });
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{SHOP_NAME}</h1>
          <p className="text-sm text-muted">
            ราคารับซื้อ — {groupName}
            {publishedAt && <> · อัปเดต {formatDateTime(publishedAt)}</>}
          </p>
        </div>
        <button
          onClick={exit}
          className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-sm text-muted hover:bg-card"
        >
          <LogOut size={14} /> ออก
        </button>
      </header>

      {/* การ์ดสรุปแนวโน้ม */}
      <section className="mb-4 rounded-card bg-card p-4">
        <p className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium">
          <Sparkles size={15} className="text-accent" /> แนวโน้มราคารอบนี้
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-price-up-bg py-2">
            <p className="inline-flex items-center gap-1 text-lg font-semibold text-price-up">
              <ArrowUpRight size={18} /> {summary.up}
            </p>
            <p className="text-xs text-price-up">ราคาขึ้น</p>
          </div>
          <div className="rounded-lg bg-price-down-bg py-2">
            <p className="inline-flex items-center gap-1 text-lg font-semibold text-price-down">
              <ArrowDownRight size={18} /> {summary.down}
            </p>
            <p className="text-xs text-price-down">ราคาลง</p>
          </div>
          <div className="rounded-lg bg-status-pending-bg py-2">
            <p className="inline-flex items-center gap-1 text-lg font-semibold text-status-pending">
              <Minus size={18} /> {summary.flat}
            </p>
            <p className="text-xs text-status-pending">คงที่/ใหม่</p>
          </div>
        </div>
        {summary.movers.length > 0 && (
          <div className="mt-3 space-y-1 border-t border-line pt-3">
            {summary.movers.map(({ item, diff }) => (
              <p key={`${item.product_id}:${item.tier_id ?? 'base'}`} className="flex items-center justify-between text-sm">
                <span className="truncate">
                  {item.product_name}{item.tier_label ? ` (${item.tier_label})` : ''}
                </span>
                <span className={`ml-2 shrink-0 font-medium ${diff > 0 ? 'text-price-up' : 'text-price-down'}`}>
                  {diff > 0 ? '+' : '−'}{formatPrice(Math.abs(diff))} บาท
                </span>
              </p>
            ))}
          </div>
        )}
      </section>

      {/* ค้นหา + กลุ่ม */}
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-card px-3">
        <Search size={16} className="text-muted" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาสินค้า เช่น ทองแดง"
          className="w-full bg-transparent py-2.5 text-sm outline-none"
        />
      </div>
      {categories.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategory('')}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
              !category ? 'bg-brand text-white' : 'border border-line bg-card text-muted'
            }`}
          >
            ทั้งหมด
          </button>
          {categories.map((c) => (
            <button
              key={c} onClick={() => setCategory(c === category ? '' : c)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                category === c ? 'bg-brand text-white' : 'border border-line bg-card text-muted'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* รายการราคา */}
      {items.length === 0 ? (
        <div className="rounded-card bg-card p-8 text-center text-sm text-muted">
          ทางร้านยังไม่ประกาศราคา — กลับมาดูใหม่อีกครั้ง
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-card bg-card p-8 text-center text-sm text-muted">
          ไม่พบสินค้าที่ค้นหา{' '}
          <button onClick={() => { setSearch(''); setCategory(''); }} className="text-brand underline">
            ล้างการค้นหา
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card bg-card">
          {filtered.map((item, i) => {
            const showCategory = !category
              && (i === 0 || filtered[i - 1].category_name !== item.category_name);
            const key = `${item.product_id}:${item.tier_id ?? 'base'}`;
            return (
              <div key={key}>
                {showCategory && (
                  <p className="border-b border-line bg-canvas px-4 py-2 text-sm font-medium text-muted">
                    {item.category_name}
                  </p>
                )}
                <button
                  onClick={() => setDetail(item)}
                  className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-canvas"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{item.product_name}</p>
                    {item.tier_label && <p className="text-xs text-muted">{item.tier_label}</p>}
                  </div>
                  <TrendBadge price={item.price} prev={item.prev_price} />
                  <div className="w-24 text-right">
                    <p className="font-semibold tabular-nums">{formatPrice(item.price)}</p>
                    <p className="text-xs text-muted">บาท/{item.unit}</p>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {detail && <PriceDetailDialog item={detail} onClose={() => setDetail(null)} />}
    </main>
  );
}

function PriceDetailDialog({ item, onClose }: { item: OverviewItem; onClose: () => void }) {
  const history = useQuery({
    queryKey: ['price_history', item.product_id, item.tier_id],
    queryFn: async () => {
      const params = new URLSearchParams({ product_id: item.product_id });
      if (item.tier_id) params.set('tier_id', item.tier_id);
      const res = await fetch(`/api/price-history?${params}`);
      if (!res.ok) throw new Error('failed');
      return (await res.json()) as Extract<PriceHistory, { ok: true }>;
    },
  });

  return (
    <Modal open onClose={onClose} title={`${item.product_name}${item.tier_label ? ` — ${item.tier_label}` : ''}`}>
      <div className="flex items-baseline justify-between">
        <p className="text-2xl font-semibold tabular-nums">{formatPrice(item.price)} <span className="text-sm font-normal text-muted">บาท/{item.unit}</span></p>
        <TrendBadge price={item.price} prev={item.prev_price} />
      </div>
      {item.prev_price != null && (
        <p className="mt-1 text-sm text-muted">รอบก่อน {formatPrice(item.prev_price)} บาท/{item.unit}</p>
      )}
      <div className="mt-4">
        <p className="mb-2 text-sm font-medium">ราคาย้อนหลัง</p>
        {history.isPending ? (
          <div className="h-24 animate-pulse rounded-lg bg-line" />
        ) : history.isError || !history.data ? (
          <p className="text-sm text-muted">โหลดข้อมูลย้อนหลังไม่สำเร็จ</p>
        ) : history.data.points.length < 2 ? (
          <p className="text-sm text-muted">ยังมีข้อมูลไม่พอสำหรับกราฟ</p>
        ) : (
          <Sparkline points={history.data.points} />
        )}
      </div>
    </Modal>
  );
}

function Sparkline({ points }: { points: { published_at: string; price: number }[] }) {
  const width = 320;
  const height = 96;
  const pad = 6;
  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2);
    const y = height - pad - ((p.price - min) / span) * (height - pad * 2);
    return `${x},${y}`;
  });
  const rising = prices[prices.length - 1] >= prices[0];
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        <polyline
          points={coords.join(' ')}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={rising ? 'stroke-price-up' : 'stroke-price-down'}
        />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{formatDateTime(points[0].published_at)}</span>
        <span>ต่ำสุด {formatPrice(min)} · สูงสุด {formatPrice(max)}</span>
      </div>
    </div>
  );
}
