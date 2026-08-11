'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KeyRound, Pencil, Plus, QrCode, Trash2 } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { EmptyState, ErrorState, PendingButton, TableSkeleton } from '@/components/ui/states';
import { Modal } from '@/components/ui/modal';
import { useConfirm } from '@/components/ui/confirm';
import { GroupQrDialog } from '@/components/groups/group-qr-dialog';
import type { Tables } from '@/lib/database.types';

type Group = Tables<'customer_groups'>;
const qk = { groups: ['customer_groups'] as const };

const GROUP_COLS = 'id, name, slug, password_version, is_active, note, created_at, updated_at, password_hash';

export default function GroupsPage() {
  const supabase = getSupabaseBrowser();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Group | 'new' | null>(null);
  const [passwordFor, setPasswordFor] = useState<Group | null>(null);
  const [qrFor, setQrFor] = useState<Group | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: qk.groups,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_groups').select(GROUP_COLS).order('name').range(0, 499);
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.groups });

  const toggleActive = useMutation({
    mutationFn: async (g: Group) => {
      const { error } = await supabase
        .from('customer_groups').update({ is_active: !g.is_active }).eq('id', g.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error('บันทึกไม่สำเร็จ'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customer_groups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('ลบกลุ่มแล้ว'); invalidate(); },
    onError: () => toast.error('ลบไม่สำเร็จ'),
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold">กลุ่มลูกค้า</h1>
        <button
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm text-white hover:opacity-90"
        >
          <Plus size={16} /> เพิ่มกลุ่ม
        </button>
      </div>

      {isPending ? <TableSkeleton /> : isError ? <ErrorState onRetry={() => refetch()} /> : !data.length ? (
        <EmptyState message="ยังไม่มีกลุ่มลูกค้า — สร้างกลุ่มแรก เช่น ลูกค้าทั่วไป" />
      ) : (
        <div className="space-y-2">
          {data.map((g) => (
            <div key={g.id} className="rounded-card bg-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{g.name}</p>
                    {!g.is_active && (
                      <span className="rounded-full bg-urgent-bg px-2 py-0.5 text-xs text-urgent">ปิดใช้งาน</span>
                    )}
                    {!g.password_hash && (
                      <span className="rounded-full bg-status-progress-bg px-2 py-0.5 text-xs text-status-progress">
                        ยังไม่ตั้งรหัสผ่าน
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted">/p/{g.slug}{g.note ? ` · ${g.note}` : ''}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setQrFor(g)} title="แสดง QR"
                    className="rounded-lg p-2 text-brand hover:bg-canvas"
                  >
                    <QrCode size={18} />
                  </button>
                  <button
                    onClick={() => setPasswordFor(g)} title="ตั้งรหัสผ่าน"
                    className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-ink"
                  >
                    <KeyRound size={18} />
                  </button>
                  <button
                    onClick={() => setEditing(g)} title="แก้ไข"
                    className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-ink"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    onClick={async () => {
                      if (await confirm({
                        title: `ลบกลุ่ม “${g.name}”?`,
                        description: 'ประวัติราคาทั้งหมดของกลุ่มนี้จะถูกลบด้วย และ QR เดิมจะใช้ไม่ได้',
                        tone: 'danger', confirmLabel: 'ลบกลุ่ม',
                      })) remove.mutate(g.id);
                    }}
                    title="ลบ" className="rounded-lg p-2 text-urgent hover:bg-urgent-bg"
                  >
                    <Trash2 size={18} />
                  </button>
                  <label className="ml-2 inline-flex cursor-pointer items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox" checked={g.is_active}
                      onChange={() => toggleActive.mutate(g)}
                      className="size-4 accent-brand"
                    />
                    เปิดใช้
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <GroupFormDialog
          group={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); invalidate(); }}
        />
      )}
      {passwordFor && (
        <GroupPasswordDialog
          group={passwordFor}
          onClose={() => setPasswordFor(null)}
          onSaved={() => { setPasswordFor(null); invalidate(); }}
        />
      )}
      {qrFor && <GroupQrDialog group={qrFor} onClose={() => setQrFor(null)} />}
    </div>
  );
}

function GroupFormDialog({
  group, onClose, onSaved,
}: { group: Group | null; onClose: () => void; onSaved: () => void }) {
  const supabase = getSupabaseBrowser();
  const [name, setName] = useState(group?.name ?? '');
  const [slug, setSlug] = useState(group?.slug ?? '');
  const [note, setNote] = useState(group?.note ?? '');

  const save = useMutation({
    mutationFn: async () => {
      if (!/^[a-z0-9-]{3,40}$/.test(slug)) {
        throw new Error('slug ต้องเป็น a-z, 0-9, ขีดกลาง ยาว 3–40 ตัว');
      }
      const payload = { name: name.trim(), slug, note: note.trim() };
      const { error } = group
        ? await supabase.from('customer_groups').update(payload).eq('id', group.id)
        : await supabase.from('customer_groups').insert(payload);
      if (error) {
        throw new Error(error.code === '23505' ? 'slug นี้ถูกใช้แล้ว' : 'บันทึกไม่สำเร็จ');
      }
    },
    onSuccess: () => { toast.success('บันทึกกลุ่มแล้ว'); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title={group ? 'แก้ไขกลุ่มลูกค้า' : 'เพิ่มกลุ่มลูกค้า'}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-muted">ชื่อกลุ่ม</label>
          <input
            required value={name} onChange={(e) => setName(e.target.value)}
            placeholder="เช่น ลูกค้าทั่วไป"
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">slug (ใช้ใน URL ของ QR)</label>
          <input
            required value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="เช่น general"
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 font-mono text-sm outline-none focus:border-brand"
          />
          {group && slug !== group.slug && (
            <p className="mt-1 text-xs text-status-progress">เปลี่ยน slug แล้ว QR เดิมจะใช้ไม่ได้ ต้องพิมพ์ใหม่</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">หมายเหตุ</label>
          <input
            value={note} onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 outline-none focus:border-brand"
          />
        </div>
        <PendingButton
          pending={save.isPending} type="submit"
          className="w-full rounded-lg bg-brand py-2.5 font-medium text-white hover:opacity-90"
        >
          บันทึก
        </PendingButton>
      </form>
    </Modal>
  );
}

function GroupPasswordDialog({
  group, onClose, onSaved,
}: { group: Group; onClose: () => void; onSaved: () => void }) {
  const supabase = getSupabaseBrowser();
  const [password, setPassword] = useState('');

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_set_group_password', {
        p_group_id: group.id, p_password: password,
      });
      if (error) {
        throw new Error(error.message.includes('password_too_short')
          ? 'รหัสผ่านต้องยาวอย่างน้อย 4 ตัว' : 'บันทึกไม่สำเร็จ');
      }
    },
    onSuccess: () => { toast.success('ตั้งรหัสผ่านใหม่แล้ว — ลูกค้าต้องใส่รหัสใหม่ทุกคน'); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title={`ตั้งรหัสผ่าน — ${group.name}`}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <p className="text-sm text-muted">
          รหัสนี้ใช้ให้ลูกค้ากลุ่มนี้เปิดดูราคาหลังสแกน QR
          การตั้งรหัสใหม่จะตัดสิทธิ์ผู้ที่เคยเข้าด้วยรหัสเดิมทันที
        </p>
        <input
          required autoFocus value={password} minLength={4}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="รหัสผ่านใหม่ (อย่างน้อย 4 ตัว)"
          className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 outline-none focus:border-brand"
        />
        <PendingButton
          pending={save.isPending} type="submit"
          className="w-full rounded-lg bg-brand py-2.5 font-medium text-white hover:opacity-90"
        >
          บันทึกรหัสผ่าน
        </PendingButton>
      </form>
    </Modal>
  );
}
