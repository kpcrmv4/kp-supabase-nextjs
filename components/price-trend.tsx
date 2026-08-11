'use client';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { formatPrice } from '@/lib/format';

export type Trend = 'up' | 'down' | 'flat' | 'new';

export function trendOf(price: number, prev: number | null | undefined): Trend {
  if (prev == null) return 'new';
  if (price > prev) return 'up';
  if (price < prev) return 'down';
  return 'flat';
}

// ลูกศรแนวโน้มราคาแบบกระดานหุ้น พร้อมส่วนต่างจากราคารอบก่อน
export function TrendBadge({ price, prev }: { price: number; prev: number | null | undefined }) {
  const trend = trendOf(price, prev);
  if (trend === 'new') {
    return <span className="rounded-full bg-status-pending-bg px-2 py-0.5 text-xs text-status-pending">ใหม่</span>;
  }
  if (trend === 'flat') {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-status-pending-bg px-2 py-0.5 text-xs text-status-pending">
        <Minus size={12} /> คงที่
      </span>
    );
  }
  const diff = Math.abs(price - (prev as number));
  const up = trend === 'up';
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        up ? 'bg-price-up-bg text-price-up' : 'bg-price-down-bg text-price-down'
      }`}
    >
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {up ? '+' : '−'}{formatPrice(diff)}
    </span>
  );
}
