// Next.js 16 renamed middleware.ts → proxy.ts
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
};
