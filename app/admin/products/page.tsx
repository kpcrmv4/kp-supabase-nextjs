'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states';
import { useConfirm } from '@/components/ui/confirm';
import { CategoryDialog, ProductDialog, type ProductWithTiers } from '@/components/products/product-dialogs';
import type { Tables } from '@/lib/database.types';

type Category = Tables<'product_categories'>;
export const qkProducts = ['products_with_tiers'] as const;
export const qkCategories = ['product_categories'] as const;

export default function ProductsPage() {
  const supabase = getSupabaseBrowser();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [editingProduct, setEditingProduct] = useState<ProductWithTiers | 'new' | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | 'new' | null>(null);

  const categories = useQuery({
    queryKey: qkCategories,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories').select('*').order('sort_order').order('name').range(0, 199);
      if (error) throw error;
      return data;
    },
  });

  const products = useQuery({
    queryKey: qkProducts,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, product_tiers(*)')
        .order('name').range(0, 999);
      if (error) throw error;
      return data as ProductWithTiers[];
    },
  });

  const removeProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('ลบสินค้าแล้ว');
      queryClient.invalidateQueries({ queryKey: qkProducts });
    },
    onError: () => toast.error('ลบไม่สำเร็จ'),
  });

  const removeCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('ลบกลุ่มสินค้าแล้ว');
      queryClient.invalidateQueries({ queryKey: qkCategories });
      queryClient.invalidateQueries({ queryKey: qkProducts });
    },
    onError: () => toast.error('ลบไม่สำเร็จ'),
  });

  const categoryName = (id: string | null) =>
    categories.data?.find((c) => c.id === id)?.name ?? 'อื่นๆ';

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold">สินค้าที่รับซื้อ</h1>
        <button
          onClick={() => setEditingProduct('new')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm text-white hover:opacity-90"
        >
          <Plus size={16} /> เพิ่มสินค้า
        </button>
      </div>

      {/* กลุ่มสินค้า */}
      <div className="mb-6 rounded-card bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="inline-flex items-center gap-2 font-medium"><Layers size={17} /> กลุ่มสินค้า</p>
          <button
            onClick={() => setEditingCategory('new')}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-sm hover:bg-canvas"
          >
            <Plus size={14} /> เพิ่ม
          </button>
        </div>
        {categories.isPending ? <TableSkeleton rows={2} /> : categories.isError ? (
          <ErrorState onRetry={() => categories.refetch()} />
        ) : !categories.data.length ? (
          <p className="text-sm text-muted">ยังไม่มีกลุ่มสินค้า เช่น เหล็ก กระดาษ พลาสติก</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.data.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-sm">
                {c.name}
                <button onClick={() => setEditingCategory(c)} className="ml-1 text-muted hover:text-ink" title="แก้ไข">
                  <Pencil size={13} />
                </button>
                <button
                  onClick={async () => {
                    if (await confirm({
                      title: `ลบกลุ่มสินค้า “${c.name}”?`,
                      description: 'สินค้าในกลุ่มนี้จะย้ายไปอยู่ “อื่นๆ” (ไม่ถูกลบ)',
                      tone: 'danger', confirmLabel: 'ลบ',
                    })) removeCategory.mutate(c.id);
                  }}
                  className="text-muted hover:text-urgent" title="ลบ"
                >
                  <Trash2 size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* รายการสินค้า */}
      {products.isPending ? <TableSkeleton /> : products.isError ? (
        <ErrorState onRetry={() => products.refetch()} />
      ) : !products.data.length ? (
        <EmptyState message="ยังไม่มีสินค้า — เพิ่มสินค้าแรก เช่น ทองแดง เหล็กหนา กระดาษลัง" />
      ) : (
        <div className="space-y-2">
          {products.data.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-card bg-card p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{p.name}</p>
                  {!p.is_active && (
                    <span className="rounded-full bg-urgent-bg px-2 py-0.5 text-xs text-urgent">ไม่รับซื้อ</span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted">
                  {categoryName(p.category_id)} · หน่วย: {p.unit}
                  {p.product_tiers.length > 0 && ` · ${p.product_tiers.length} ขั้นราคา`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditingProduct(p)} title="แก้ไข"
                  className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-ink"
                >
                  <Pencil size={18} />
                </button>
                <button
                  onClick={async () => {
                    if (await confirm({
                      title: `ลบ “${p.name}”?`,
                      description: 'ประวัติราคาของสินค้านี้จะถูกลบด้วย ถ้าแค่หยุดรับซื้อ ให้แก้ไขแล้วปิด “รับซื้ออยู่” แทน',
                      tone: 'danger', confirmLabel: 'ลบสินค้า',
                    })) removeProduct.mutate(p.id);
                  }}
                  title="ลบ" className="rounded-lg p-2 text-urgent hover:bg-urgent-bg"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingProduct && (
        <ProductDialog
          product={editingProduct === 'new' ? null : editingProduct}
          categories={categories.data ?? []}
          onClose={() => setEditingProduct(null)}
          onSaved={() => {
            setEditingProduct(null);
            queryClient.invalidateQueries({ queryKey: qkProducts });
          }}
        />
      )}
      {editingCategory && (
        <CategoryDialog
          category={editingCategory === 'new' ? null : editingCategory}
          onClose={() => setEditingCategory(null)}
          onSaved={() => {
            setEditingCategory(null);
            queryClient.invalidateQueries({ queryKey: qkCategories });
          }}
        />
      )}
    </div>
  );
}
