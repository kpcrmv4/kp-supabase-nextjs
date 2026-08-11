'use client';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';

export function NoAccess({ email }: { email: string }) {
  const router = useRouter();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <ShieldAlert size={40} className="text-urgent" />
      <div>
        <p className="font-semibold">บัญชีนี้ไม่มีสิทธิ์เข้าหน้าผู้ดูแล</p>
        <p className="mt-1 text-sm text-muted">{email}</p>
      </div>
      <button
        onClick={async () => {
          await getSupabaseBrowser().auth.signOut({ scope: 'local' });
          router.replace('/login');
          router.refresh();
        }}
        className="rounded-lg bg-brand px-4 py-2 text-sm text-white hover:opacity-90"
      >
        ออกจากระบบ
      </button>
    </main>
  );
}
