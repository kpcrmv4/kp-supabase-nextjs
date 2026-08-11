'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import { PendingButton } from '@/components/ui/states';
import { SHOP_NAME } from '@/lib/constants';

export function PasswordForm({ slug, sessionExpired }: { slug: string; sessionExpired: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await fetch('/api/group-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, password }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      if (res.status === 429) {
        toast.error('ลองผิดหลายครั้งเกินไป — รอ 15 นาทีแล้วลองใหม่');
      } else {
        toast.error('รหัสผ่านไม่ถูกต้อง หรือกลุ่มนี้ปิดใช้งานแล้ว');
      }
    } catch {
      toast.error('เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง');
    }
    setPending(false);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-card bg-card p-6 shadow-pop">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="rounded-2xl bg-brand p-3 text-white"><KeyRound size={26} /></span>
          <h1 className="text-lg font-semibold">{SHOP_NAME}</h1>
          <p className="text-sm text-muted">
            {sessionExpired
              ? 'รหัสผ่านของกลุ่มถูกเปลี่ยน หรือสิทธิ์หมดอายุ — กรุณาใส่รหัสใหม่'
              : 'ใส่รหัสผ่านที่ได้รับจากทางร้านเพื่อดูราคารับซื้อ'}
          </p>
        </div>
        <input
          type="password" required autoFocus value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="รหัสผ่านกลุ่ม"
          className="mb-4 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-center outline-none focus:border-brand"
        />
        <PendingButton
          pending={pending} type="submit"
          className="w-full rounded-lg bg-brand py-2.5 font-medium text-white hover:opacity-90"
        >
          ดูราคารับซื้อ
        </PendingButton>
      </form>
    </main>
  );
}
