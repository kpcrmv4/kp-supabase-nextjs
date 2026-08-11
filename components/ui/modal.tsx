'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export function Modal({
  open, onClose, title, children, wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className={`fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[92vw] ${
            wide ? 'max-w-2xl' : 'max-w-md'
          } -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card bg-card p-5 shadow-pop`}
        >
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="font-semibold">{title}</Dialog.Title>
            <Dialog.Close className="rounded-lg p-1 text-muted hover:bg-canvas" aria-label="ปิด">
              <X size={18} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
