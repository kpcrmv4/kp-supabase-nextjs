'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/modal';
import { PendingButton } from '@/components/ui/states';
import type { Tables } from '@/lib/database.types';

export type ProductWithTiers = Tables<'products'> & { product_tiers: Tables<'product_tiers'>[] };

type TierDraft = { label: string; min_qty: string; max_qty: string };

export function ProductDialog({
  product, categories, onClose, onSaved,
}: {
  product: ProductWithTiers | null;
  categories: Tables<'product_categories'>[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = getSupabaseBrowser();
  const [name, setName] = useState(product?.name ?? '');
  const [unit, setUnit] = useState(product?.unit ?? 'กก.');
  const [categoryId, setCategoryId] = useState(product?.category_id ?? '');
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [tiers, setTiers] = useState<TierDraft[]>(
    (product?.product_tiers ?? [])
      .slice()
      .sort((a, b) => a.min_qty - b.min_qty)
      .map((t) => ({ label: t.label, min_qty: String(t.min_qty), max_qty: t.max_qty == null ? '' : String(t.max_qty) })),
  );

  function setTier(i: number, patch: Partial<TierDraft>) {
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  const save = useMutation({
    mutationFn: async () => {
      const cleanTiers = tiers
        .filter((t) => t.label.trim())
        .map((t, i) => ({
          label: t.label.trim(),
          min_qty: Number(t.min_qty) || 0,
          max_qty: t.max_qty === '' ? null : Number(t.max_qty),
          sort_order: i,
        }));
      for (const t of cleanTiers) {
        if (t.max_qty != null && t.max_qty <= t.min_qty) {
          throw new Error(`ขั้น “${t.label}”: ปริมาณสูงสุดต้องมากกว่าต่ำสุด`);
        }
      }
      const payload = {
        name: name.trim(), unit: unit.trim() || 'กก.',
        category_id: categoryId || null, is_active: isActive,
      };
      let productId = product?.id;
      if (product) {
        const { error } = await supabase.from('products').update(payload).eq('id', product.id);
        if (error) throw new Error('บันทึกสินค้าไม่สำเร็จ');
      } else {
        const { data, error } = await supabase.from('products').insert(payload).select('id').single();
        if (error || !data) throw new Error('บันทึกสินค้าไม่สำเร็จ');
        productId = data.id;
      }
      // แทนที่ขั้นราคาทั้งชุด (ขั้นเดิมที่ถูกลบจะพาไอเท็มราคาเก่าของขั้นนั้นหายไปด้วย)
      const { error: delError } = await supabase.from('product_tiers').delete().eq('product_id', productId!);
      if (delError) throw new Error('บันทึกขั้นราคาไม่สำเร็จ');
      if (cleanTiers.length) {
        const { error: insError } = await supabase
          .from('product_tiers')
          .insert(cleanTiers.map((t) => ({ ...t, product_id: productId! })));
        if (insError) throw new Error('บันทึกขั้นราคาไม่สำเร็จ');
      }
    },
    onSuccess: () => { toast.success('บันทึกสินค้าแล้ว'); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title={product ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'} wide>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-muted">ชื่อสินค้า</label>
            <input
              required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="เช่น ทองแดงเบอร์ 1"
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 outline-none focus:border-brand"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-muted">หน่วย</label>
              <input
                value={unit} onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">กลุ่มสินค้า</label>
              <select
                value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 outline-none focus:border-brand"
              >
                <option value="">อื่นๆ</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox" checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="size-4 accent-brand"
          />
          รับซื้ออยู่ (แสดงให้ลูกค้าเห็น)
        </label>

        <div className="rounded-card border border-line p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">ขั้นราคาตามปริมาณ (ไม่บังคับ)</p>
            <button
              type="button"
              onClick={() => setTiers((p) => [...p, { label: '', min_qty: '0', max_qty: '' }])}
              className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-sm hover:bg-canvas"
            >
              <Plus size={14} /> เพิ่มขั้น
            </button>
          </div>
          {tiers.length === 0 ? (
            <p className="text-sm text-muted">ไม่ตั้งขั้น = ใช้ราคาเดียวทุกปริมาณ</p>
          ) : (
            <div className="space-y-2">
              {tiers.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={t.label} onChange={(e) => setTier(i, { label: e.target.value })}
                    placeholder={`เช่น ต่ำกว่า 5 ${unit}`}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                  <input
                    type="number" step="any" min="0" value={t.min_qty}
                    onChange={(e) => setTier(i, { min_qty: e.target.value })}
                    placeholder="ต่ำสุด"
                    className="w-20 rounded-lg border border-line bg-canvas px-2 py-2 text-sm outline-none focus:border-brand"
                  />
                  <span className="text-muted">–</span>
                  <input
                    type="number" step="any" min="0" value={t.max_qty}
                    onChange={(e) => setTier(i, { max_qty: e.target.value })}
                    placeholder="ไม่จำกัด"
                    className="w-20 rounded-lg border border-line bg-canvas px-2 py-2 text-sm outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={() => setTiers((p) => p.filter((_, idx) => idx !== i))}
                    className="rounded-lg p-2 text-urgent hover:bg-urgent-bg" title="ลบขั้น"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <p className="text-xs text-muted">เปลี่ยนขั้นราคาแล้ว อย่าลืมไปตั้งราคาของขั้นใหม่ในหน้า “ตั้งราคา”</p>
            </div>
          )}
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

export function CategoryDialog({
  category, onClose, onSaved,
}: {
  category: Tables<'product_categories'> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = getSupabaseBrowser();
  const [name, setName] = useState(category?.name ?? '');
  const [sortOrder, setSortOrder] = useState(String(category?.sort_order ?? 0));

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name: name.trim(), sort_order: Number(sortOrder) || 0 };
      const { error } = category
        ? await supabase.from('product_categories').update(payload).eq('id', category.id)
        : await supabase.from('product_categories').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('บันทึกกลุ่มสินค้าแล้ว'); onSaved(); },
    onError: () => toast.error('บันทึกไม่สำเร็จ'),
  });

  return (
    <Modal open onClose={onClose} title={category ? 'แก้ไขกลุ่มสินค้า' : 'เพิ่มกลุ่มสินค้า'}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-muted">ชื่อกลุ่ม</label>
          <input
            required autoFocus value={name} onChange={(e) => setName(e.target.value)}
            placeholder="เช่น เหล็ก / กระดาษ / พลาสติก"
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">ลำดับการแสดง (น้อยขึ้นก่อน)</label>
          <input
            type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}
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
