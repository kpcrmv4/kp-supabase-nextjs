'use client';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Copy, Printer } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { SHOP_NAME } from '@/lib/constants';
import type { Tables } from '@/lib/database.types';

export function GroupQrDialog({
  group, onClose,
}: { group: Tables<'customer_groups'>; onClose: () => void }) {
  const url = `${window.location.origin}/p/${group.slug}`;

  return (
    <Modal open onClose={onClose} title={`QR — ${group.name}`}>
      <div id="qr-print-area" className="flex flex-col items-center gap-3 py-2 text-center">
        <p className="hidden text-lg font-semibold print:block">{SHOP_NAME}</p>
        <p className="hidden print:block">เช็คราคารับซื้อ — {group.name}</p>
        <div className="rounded-card border border-line bg-white p-4">
          <QRCodeSVG value={url} size={220} marginSize={1} />
        </div>
        <p className="break-all font-mono text-xs text-muted print:text-sm">{url}</p>
        <p className="text-sm text-muted print:hidden">
          ลูกค้าสแกนแล้วต้องใส่รหัสผ่านของกลุ่มนี้จึงจะเห็นราคา
        </p>
        <div className="mt-2 flex gap-2 print:hidden" data-noprint>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              toast.success('คัดลอกลิงก์แล้ว');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-sm hover:bg-canvas"
          >
            <Copy size={16} /> คัดลอกลิงก์
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm text-white hover:opacity-90"
          >
            <Printer size={16} /> พิมพ์
          </button>
        </div>
      </div>
    </Modal>
  );
}
