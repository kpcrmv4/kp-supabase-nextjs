'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import {
  Banknote, History, LayoutDashboard, LogOut, Moon, Package, Scale, Sun, Users,
  type LucideIcon,
} from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { APP_NAME } from '@/lib/constants';

type NavItem = { href: string; label: string; icon: LucideIcon; primary?: boolean };

const NAV: NavItem[] = [
  { href: '/admin', label: 'ภาพรวม', icon: LayoutDashboard },
  { href: '/admin/groups', label: 'กลุ่มลูกค้า', icon: Users },
  { href: '/admin/pricing', label: 'ตั้งราคา', icon: Banknote, primary: true },
  { href: '/admin/products', label: 'สินค้า', icon: Package },
  { href: '/admin/history', label: 'ประวัติ', icon: History },
];

function isActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="size-9" />;
  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
      aria-label="สลับธีม"
    >
      {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

export function AdminShell({ userName, children }: { userName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await getSupabaseBrowser().auth.signOut({ scope: 'local' });
    router.replace('/login');
    router.refresh();
  }

  const primary = NAV.find((i) => i.primary)!;
  const rest = NAV.filter((i) => !i.primary);

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside
        data-noprint
        className="fixed inset-y-0 left-0 z-40 hidden w-[236px] flex-col bg-brand-sidebar text-white min-[860px]:flex"
      >
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="rounded-xl bg-white/10 p-2"><Scale size={20} /></span>
          <span className="font-semibold">{APP_NAME}</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href} href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                isActive(pathname, href)
                  ? 'bg-white/15 font-medium text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={18} /> {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
          <span className="truncate text-sm text-white/70">{userName}</span>
          <div className="flex items-center">
            <ThemeToggle />
            <button
              onClick={signOut}
              className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="ออกจากระบบ"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="px-4 pb-24 pt-5 min-[860px]:ml-[236px] min-[860px]:px-8 min-[860px]:pb-10">
        {children}
      </main>

      {/* Mobile bottom nav — 5 slots, raised center primary */}
      <nav
        data-noprint
        className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] min-[860px]:hidden"
      >
        {[rest[0], rest[1], primary, rest[2], rest[3]].map(({ href, label, icon: Icon, primary: isPrimary }) => {
          const active = isActive(pathname, href);
          if (isPrimary) {
            return (
              <Link key={href} href={href} className="relative flex flex-col items-center justify-end pb-1.5">
                <span
                  className={`absolute -top-5 flex size-[52px] items-center justify-center rounded-full text-white shadow-pop ring-4 ring-canvas ${
                    active ? 'bg-accent' : 'bg-brand'
                  }`}
                >
                  <Icon size={22} />
                </span>
                <span className={`text-[11px] ${active ? 'text-brand font-medium' : 'text-muted'}`}>{label}</span>
              </Link>
            );
          }
          return (
            <Link key={href} href={href} className="flex flex-col items-center justify-center gap-0.5">
              <Icon size={20} className={active ? 'text-brand' : 'text-muted'} />
              <span className={`text-[11px] ${active ? 'text-brand font-medium' : 'text-muted'}`}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
