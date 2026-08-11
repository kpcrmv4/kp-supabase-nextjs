// Bare anon client for customer-side RPCs (no auth session involved).
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

export function getSupabaseAnon() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
