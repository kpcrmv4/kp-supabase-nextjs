'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Scale } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { PendingButton } from '@/components/ui/states';
import { APP_NAME, SHOP_NAME } from '@/lib/constants';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const { error } = await getSupabaseBrowser().auth.signInWithPassword({ email, password });
    if (error) {
      toast.error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      setPending(false);
      return;
    }
    const next = searchParams.get('next');
    router.replace(next && next.startsWith('/') ? next : '/admin');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm rounded-card bg-card p-6 shadow-pop">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <span className="rounded-2xl bg-brand p-3 text-white"><Scale size={28} /></span>
        <h1 className="text-lg font-semibold">{APP_NAME}</h1>
        <p className="text-sm text-muted">{SHOP_NAME} — เข้าสู่ระบบผู้ดูแล</p>
      </div>
      <label className="mb-1 block text-sm text-muted" htmlFor="email">อีเมล</label>
      <input
        id="email" type="email" required value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mb-4 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 outline-none focus:border-brand"
      />
      <label className="mb-1 block text-sm text-muted" htmlFor="password">รหัสผ่าน</label>
      <input
        id="password" type="password" required value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-6 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 outline-none focus:border-brand"
      />
      <PendingButton
        pending={pending} type="submit"
        className="w-full rounded-lg bg-brand py-2.5 font-medium text-white hover:opacity-90"
      >
        เข้าสู่ระบบ
      </PendingButton>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
