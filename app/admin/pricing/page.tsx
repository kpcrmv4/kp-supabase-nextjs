'use client';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, FileDown, Rocket, Save } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { EmptyState, ErrorState, PendingButton, TableSkeleton } from '@/components/ui/states';
import { Modal } from '@/components/ui/modal';
import { useConfirm } from '@/components/ui/confirm';
import { TrendBadge } from '@/components/price-trend';
import { formatDateTime, formatPrice } from '@/lib/format';
import type { Tables } from '@/lib/database.types';

type CurrentPrice = { product_id: string; tier_id: string | null; price: number; prev_price: number | null };
type Row = {
  key: string;
  product: Tables<'products'>;
  categoryName: string;
  categorySort: number;
  tier: Tables<'product_tiers'> | null;
  current: CurrentPrice | undefined;
};

const rowKey = (productId: string, tierId: string | null) => `${productId}:${tierId ?? 'base'}`;

export default function PricingPage() {
  const supabase = getSupabaseBrowser();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [groupId, setGroupId] = useState('');
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const groups = useQuery({
    queryKey: ['customer_groups', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_groups').select('id, name, slug')
        .eq('is_active', true).order('name').range(0, 499);
      if (error) throw error;
      return data;
    },
  });

  const board = useQuery({
    queryKey: ['pricing_board', groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const [productsRes, currentRes, draftRes] = await Promise.all([
        supabase.from('products')
          .select('*, product_tiers(*), product_categories(name, sort_order)')
          .eq('is_active', true).order('name').range(0, 999),
        supabase.rpc('admin_current_prices', { p_group_id: groupId }),
        supabase.from('price_lists')
          .select('id, status, publish_at, note, updated_at, price_list_items(product_id, tier_id, price)')
          .eq('group_id', groupId).in('status', ['draft', 'scheduled'])
          .order('updated_at', { ascending: false }).range(0, 0),
      ]);
      if (productsRes.error) throw productsRes.error;
      if (currentRes.error) throw currentRes.error;
      if (draftRes.error) throw draftRes.error;
      return {
        products: productsRes.data,
        current: (currentRes.data ?? []) as unknown as CurrentPrice[],
        draft: draftRes.data?.[0] ?? null,
      };
    },
  });

  const rows = useMemo<Row[]>(() => {
    if (!board.data) return [];
    const currentByKey = new Map(board.data.current.map((c) => [rowKey(c.product_id, c.tier_id), c]));
    const out: Row[] = [];
    for (const p of board.data.products) {
      const category = p.product_categories as { name: string; sort_order: number } | null;
      const base = {
        product: p as unknown as Tables<'products'>,
        categoryName: category?.name ?? 'อื่นๆ',
        categorySort: category?.sort_order ?? 999999,
      };
      const tiers = (p.product_tiers as Tables<'product_tiers'>[]).slice()
        .sort((a, b) => a.min_qty - b.min_qty);
      if (tiers.length === 0) {
        const key = rowKey(p.id, null);
        out.push({ ...base, key, tier: null, current: currentByKey.get(key) });
      } else {
        for (const t of tiers) {
          const key = rowKey(p.id, t.id);
          out.push({ ...base, key, tier: t, current: currentByKey.get(key) });
        }
      }
    }
    return out.sort((a, b) =>
      a.categorySort - b.categorySort
      || a.categoryName.localeCompare(b.categoryName, 'th')
      || a.product.name.localeCompare(b.product.name, 'th'));
  }, [board.data]);

  // เติมค่าเริ่มต้นเมื่อโหลดบอร์ดใหม่: ร่างที่ค้างอยู่ก่อน ถ้าไม่มีใช้ราคาปัจจุบัน
  useEffect(() => {
    if (!board.data) return;
    const next: Record<string, string> = {};
    if (board.data.draft) {
      for (const item of board.data.draft.price_list_items) {
        next[rowKey(item.product_id, item.tier_id)] = String(item.price);
      }
      setNote(board.data.draft.note);
    } else {
      for (const c of board.data.current) {
        next[rowKey(c.product_id, c.tier_id)] = String(c.price);
      }
      setNote('');
    }
    setPrices(next);
  }, [board.data]);

  const filledItems = useMemo(
    () => rows
      .filter((r) => prices[r.key]?.trim() !== '' && prices[r.key] != null && !Number.isNaN(Number(prices[r.key])))
      .map((r) => ({
        product_id: r.product.id,
        tier_id: r.tier?.id ?? null,
        price: Number(prices[r.key]),
      })),
    [rows, prices],
  );

  const save = useMutation({
    mutationFn: async ({ action, publishAt }: { action: 'draft' | 'publish' | 'schedule'; publishAt?: string }) => {
      if (!filledItems.length) throw new Error('ยังไม่ได้กรอกราคาเลย');
      if (filledItems.some((i) => i.price < 0)) throw new Error('ราคาต้องไม่ติดลบ');
      const { error } = await supabase.rpc('save_price_list', {
        p_group_id: groupId,
        p_items: filledItems,
        p_action: action,
        p_publish_at: publishAt,
        p_note: note.trim(),
        p_list_id: board.data?.draft?.id,
      });
      if (error) throw new Error('บันทึกไม่สำเร็จ');
      return action;
    },
    onSuccess: (action) => {
      toast.success(action === 'draft' ? 'บันทึกร่างแล้ว'
        : action === 'publish' ? 'เผยแพร่ราคาใหม่แล้ว' : 'ตั้งเวลาเผยแพร่แล้ว');
      setScheduleOpen(false);
      queryClient.invalidateQueries({ queryKey: ['pricing_board', groupId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changedCount = rows.filter((r) => {
    const v = prices[r.key];
    return v != null && v.trim() !== '' && r.current && Number(v) !== r.current.price;
  }).length;

  const groupName = groups.data?.find((g) => g.id === groupId)?.name ?? '';

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-5 text-xl font-semibold">ตั้งราคา</h1>

      <div className="mb-4 rounded-card bg-card p-4">
        <label className="mb-1 block text-sm text-muted">กลุ่มลูกค้า</label>
        <select
          value={groupId} onChange={(e) => setGroupId(e.target.value)}
          className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 outline-none focus:border-brand sm:max-w-xs"
        >
          <option value="">— เลือกกลุ่มลูกค้า —</option>
          {(groups.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        {board.data?.draft && (
          <p className="mt-2 text-sm text-status-progress">
            {board.data.draft.status === 'scheduled'
              ? `มีรายการตั้งเวลาเผยแพร่ ${formatDateTime(board.data.draft.publish_at)} อยู่ — แก้ไขและบันทึกทับได้`
              : 'กำลังแก้ไขร่างที่ค้างอยู่ — บันทึกจะทับร่างเดิม'}
          </p>
        )}
      </div>

      {!groupId ? (
        <EmptyState message="เลือกกลุ่มลูกค้าเพื่อเริ่มตั้งราคา" />
      ) : board.isPending ? <TableSkeleton rows={6} /> : board.isError ? (
        <ErrorState onRetry={() => board.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState message="ยังไม่มีสินค้าที่รับซื้อ — เพิ่มสินค้าก่อนในหน้า “สินค้า”" />
      ) : (
        <>
          <div className="overflow-hidden rounded-card bg-card">
            {rows.map((r, i) => {
              const showCategory = i === 0 || rows[i - 1].categoryName !== r.categoryName;
              return (
                <div key={r.key}>
                  {showCategory && (
                    <p className="border-b border-line bg-canvas px-4 py-2 text-sm font-medium text-muted">
                      {r.categoryName}
                    </p>
                  )}
                  <div className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        {r.product.name}
                        {r.tier && <span className="text-muted"> — {r.tier.label}</span>}
                      </p>
                      <p className="text-xs text-muted">
                        {r.current ? `ปัจจุบัน ${formatPrice(r.current.price)} บาท/${r.product.unit}` : 'ยังไม่เคยตั้งราคา'}
                      </p>
                    </div>
                    {r.current && <TrendBadge price={r.current.price} prev={r.current.prev_price} />}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number" inputMode="decimal" step="0.25" min="0"
                        value={prices[r.key] ?? ''}
                        onChange={(e) => setPrices((p) => ({ ...p, [r.key]: e.target.value }))}
                        placeholder="—"
                        className="w-24 rounded-lg border border-line bg-canvas px-2 py-2 text-right outline-none focus:border-brand"
                      />
                      <span className="w-9 text-xs text-muted">฿/{r.product.unit}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-card bg-card p-4">
            <label className="mb-1 block text-sm text-muted">หมายเหตุรอบราคา (ลูกค้าไม่เห็น)</label>
            <input
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ปรับตามราคาตลาดเช้านี้"
              className="mb-4 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 outline-none focus:border-brand"
            />
            <p className="mb-3 text-sm text-muted">
              กรอกแล้ว {filledItems.length.toLocaleString('th-TH')} รายการ
              {changedCount > 0 && ` · เปลี่ยนจากราคาปัจจุบัน ${changedCount.toLocaleString('th-TH')} รายการ`}
            </p>
            <div className="flex flex-wrap gap-2">
              <PendingButton
                pending={save.isPending}
                onClick={() => save.mutate({ action: 'draft' })}
                className="rounded-lg border border-line px-4 py-2.5 text-sm hover:bg-canvas"
              >
                <Save size={16} /> บันทึกร่าง
              </PendingButton>
              <PendingButton
                pending={save.isPending}
                onClick={() => setScheduleOpen(true)}
                className="rounded-lg border border-line px-4 py-2.5 text-sm hover:bg-canvas"
              >
                <CalendarClock size={16} /> ตั้งเวลาเผยแพร่
              </PendingButton>
              <PendingButton
                pending={save.isPending}
                onClick={async () => {
                  if (await confirm({
                    title: `เผยแพร่ราคาใหม่ให้ “${groupName}”?`,
                    description: `${filledItems.length} รายการจะแสดงให้ลูกค้ากลุ่มนี้เห็นทันที`,
                    confirmLabel: 'เผยแพร่เลย',
                  })) save.mutate({ action: 'publish' });
                }}
                className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
              >
                <Rocket size={16} /> เผยแพร่ทันที
              </PendingButton>
              <button
                onClick={() => {
                  const next: Record<string, string> = {};
                  for (const c of board.data.current) next[rowKey(c.product_id, c.tier_id)] = String(c.price);
                  setPrices(next);
                  toast.info('เติมราคาปัจจุบันให้แล้ว');
                }}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-muted hover:bg-canvas"
              >
                <FileDown size={16} /> ใช้ราคาปัจจุบัน
              </button>
            </div>
          </div>
        </>
      )}

      <ScheduleDialog
        open={scheduleOpen}
        pending={save.isPending}
        onClose={() => setScheduleOpen(false)}
        onSchedule={(iso) => save.mutate({ action: 'schedule', publishAt: iso })}
      />
    </div>
  );
}

function ScheduleDialog({
  open, pending, onClose, onSchedule,
}: {
  open: boolean; pending: boolean;
  onClose: () => void;
  onSchedule: (iso: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <Modal open={open} onClose={onClose} title="ตั้งเวลาเผยแพร่ราคา">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const date = new Date(value);
          if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
            toast.error('เลือกเวลาในอนาคต');
            return;
          }
          onSchedule(date.toISOString());
        }}
        className="space-y-4"
      >
        <p className="text-sm text-muted">
          ราคาจะถูกเผยแพร่อัตโนมัติเมื่อถึงเวลา (คลาดเคลื่อนไม่เกิน 1 นาที) — ระหว่างนั้นลูกค้ายังเห็นราคาชุดเดิม
        </p>
        <input
          type="datetime-local" required value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 outline-none focus:border-brand"
        />
        <PendingButton
          pending={pending} type="submit"
          className="w-full rounded-lg bg-brand py-2.5 font-medium text-white hover:opacity-90"
        >
          ยืนยันตั้งเวลา
        </PendingButton>
      </form>
    </Modal>
  );
}
