// Customer "session" for /p/[slug] — NOT Supabase Auth.
// A signed {gid, ver, exp} payload; the DB re-validates gid+ver on every RPC,
// so changing the group password or deactivating the group revokes access
// immediately even while the cookie is still valid.
import { createHmac, timingSafeEqual } from 'crypto';

export type GroupSession = { gid: string; ver: number; exp: number };

function secret() {
  const s = process.env.GROUP_SESSION_SECRET;
  if (!s) throw new Error('GROUP_SESSION_SECRET is not configured');
  return s;
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createGroupSessionToken(gid: string, ver: number, maxAgeSeconds: number) {
  const payload = Buffer.from(
    JSON.stringify({ gid, ver, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds } satisfies GroupSession),
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyGroupSessionToken(token: string | undefined): GroupSession | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as GroupSession;
    if (typeof session.gid !== 'string' || typeof session.ver !== 'number') return null;
    if (session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}
