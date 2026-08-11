import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
import { AdminShell } from '@/components/shell/admin-shell';
import { NoAccess } from '@/components/shell/no-access';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, role, is_active')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || profile.role !== 'admin' || !profile.is_active) {
    return <NoAccess email={user.email ?? ''} />;
  }

  return <AdminShell userName={profile.full_name || (user.email ?? '')}>{children}</AdminShell>;
}
