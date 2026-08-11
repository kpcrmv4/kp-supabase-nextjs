'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states';
import { useConfirm } from '@/components/ui/confirm';
import { formatDateTime } from '@/lib/format';
import type { Tables } from '@/lib/database.types';

const PAGE_SIZE = 20;

const STATUS: Record<Tables<'price_lists'>['status'], { label: string; cls: string }> = {
  draft: { label: 'ร่าง', cls: 'text-status-pending bg-status-pending-bg' },
  scheduled: { label: 'ตั้งเวลาไว้', cls: 'text-status-progress bg-status-progress-bg' },
  published: { label: 'เผยแพร่แล้ว', cls: 'text-status-done bg-status-done-bg' },
  archived: { label: 'เก็บถาวร', cls: 'text-status-pending bg-status-pending-bg' },
};

export default function HistoryPage() {
  const supabase = getSupabaseBrowser();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [page, setPage] = useState(0);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['price_lists_history', page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const { data, error, count } = await supabase
        .from('price_lists')
        .select('id, status, publish_at, published_at, note, created_at, customer_groups(name), price_list_items(count)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });

  const cancelScheduled = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('price_lists')
        .update({ status: 'draft', publish_at: null })
        .eq('id', id).eq('status', 'scheduled');
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('ยกเลิกการตั้งเวลาแล้ว (กลับเป็นร่าง)');
      queryClient.invalidateQueries({ queryKey: ['price_lists_history'] });
    },
    onError: () => toast.error('ยกเลิกไม่สำเร็จ'),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-5 text-xl font-semibold">ประวัติราคา</h1>

      {isPending ? <TableSkeleton rows={6} /> : isError ? <ErrorState onRetry={() => refetch()} /> : !data.rows.length ? (
        <EmptyState message="ยังไม่มีประวัติ — เริ่มจากหน้า “ตั้งราคา”" />
      ) : (
        <>
          <div className="space-y-2">
            {data.rows.map((row) => {
              const status = STATUS[row.status];
              const itemCount = (row.price_list_items as unknown as { count: number }[])[0]?.count ?? 0;
              return (
                <div key={row.id} className="flex flex-wrap items-center gap-3 rounded-card bg-card p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{(row.customer_groups as { name: string } | null)?.name ?? '-'}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${status.cls}`}>{status.label}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted">
                      {row.status === 'published' && `เผยแพร่ ${formatDateTime(row.published_at)}`}
                      {row.status === 'scheduled' && `จะเผยแพร่ ${formatDateTime(row.publish_at)}`}
                      {(row.status === 'draft' || row.status === 'archived') && `สร้าง ${formatDateTime(row.created_at)}`}
                      {` · ${itemCount.toLocaleString('th-TH')} รายการ`}
                      {row.note && ` · ${row.note}`}
                    </p>
                  </div>
                  {row.status === 'scheduled' && (
                    <button
                      onClick={async () => {
                        if (await confirm({
                          title: 'ยกเลิกการตั้งเวลาเผยแพร่?',
                          description: 'รายการจะกลับเป็นร่าง แก้ไขต่อได้ในหน้า “ตั้งราคา”',
                          tone: 'danger', confirmLabel: 'ยกเลิกตั้งเวลา',
                        })) cancelScheduled.mutate(row.id);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-canvas"
                    >
                      <X size={14} /> ยกเลิกตั้งเวลา
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-muted">
            <span>
              แสดง {(page * PAGE_SIZE + 1).toLocaleString('th-TH')}–{Math.min((page + 1) * PAGE_SIZE, data.count).toLocaleString('th-TH')} จาก {data.count.toLocaleString('th-TH')} รายการ
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 0} onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-line p-2 disabled:opacity-40" aria-label="ก่อนหน้า"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2">{page + 1} / {totalPages}</span>
              <button
                disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-line p-2 disabled:opacity-40" aria-label="ถัดไป"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
