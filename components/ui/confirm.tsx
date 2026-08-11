'use client';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle } from 'lucide-react';

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: 'default' | 'danger';
};

const ConfirmContext = createContext<(opts: ConfirmOptions) => Promise<boolean>>(
  async () => false,
);

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  const close = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog.Root open={!!opts} onOpenChange={(open) => { if (!open) close(false); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-card bg-card p-5 shadow-pop">
            <div className="flex items-start gap-3">
              {opts?.tone === 'danger' && (
                <span className="mt-0.5 rounded-full bg-urgent-bg p-2 text-urgent">
                  <AlertTriangle size={18} />
                </span>
              )}
              <div className="min-w-0">
                <Dialog.Title className="font-semibold">{opts?.title}</Dialog.Title>
                {opts?.description && (
                  <Dialog.Description className="mt-1 text-sm text-muted">
                    {opts.description}
                  </Dialog.Description>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => close(false)}
                className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => close(true)}
                className={`rounded-lg px-4 py-2 text-sm text-white ${
                  opts?.tone === 'danger' ? 'bg-urgent hover:opacity-90' : 'bg-brand hover:opacity-90'
                }`}
              >
                {opts?.confirmLabel ?? 'ยืนยัน'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ConfirmContext.Provider>
  );
}
