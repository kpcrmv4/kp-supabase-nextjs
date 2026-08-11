# KP ราคารับซื้อของเก่า (Junk-Shop Price Board)

ระบบจัดการราคาร้านรับซื้อของเก่า: แอดมินตั้งราคารับซื้อแยกตามกลุ่มลูกค้า
(ทั่วไป/ขายส่ง) พร้อมระบบร่าง + ตั้งเวลาเผยแพร่ ลูกค้าสแกน QR ของกลุ่มตัวเอง
ใส่รหัสผ่านกลุ่มแล้วดูราคาปัจจุบัน พร้อมลูกศรขึ้น/ลงเทียบราคารอบก่อนแบบกระดานหุ้น

> Repo นี้เป็นทั้ง Claude Code plugin marketplace (`plugins/`, `.claude-plugin/`)
> และตัวแอป Next.js ที่ root — อย่าแตะไฟล์ marketplace เมื่อทำงานฝั่งแอป

## Roles

| Role | เข้าผ่าน | เห็น/ทำอะไรได้ |
|------|---------|----------------|
| **admin** | `/login` (email+password, Supabase Auth) | CRUD กลุ่มลูกค้า, สินค้า+กลุ่มสินค้า+ขั้นราคาตามปริมาณ, ตั้งราคา (ร่าง/เผยแพร่/ตั้งเวลา), ดู QR + ตั้งรหัสผ่านกลุ่ม, ประวัติราคา |
| **staff** | `/login` | ยังไม่เปิดใช้ — โปรไฟล์ default เป็น `staff` แต่หน้า admin เช็ค `is_admin()` เสมอ |
| **customer** | สแกน QR → `/p/[slug]` + รหัสผ่านกลุ่ม (ไม่มี account) | ดูราคาปัจจุบันของกลุ่มตัวเอง, ค้นหา, ลูกศรแนวโน้ม, การ์ดสรุป, กราฟราคาย้อนหลัง |

## Tech stack

| ส่วน | เลือกใช้ |
|------|----------|
| Framework | Next.js 16 App Router + React + TS (**`proxy.ts`** ไม่ใช่ middleware.ts) |
| Styling | Tailwind v4 CSS-first tokens + next-themes (dark mode class strategy) |
| Data | Supabase (`@supabase/ssr` + `@supabase/supabase-js` ล่าสุดคู่กันเสมอ), @tanstack/react-query |
| UI | lucide-react (ห้าม emoji), sonner (ห้าม alert()), @radix-ui/react-dialog, IBM Plex Sans Thai (next/font) |
| QR | `qrcode.react` ฝั่ง client |
| Deploy | Vercel (`vercel.json` regions `sin1`) — Supabase อยู่ Singapore |

## Supabase connection

- โปรเจกต์: `miapttbegcccferyrmco` → https://miapttbegcccferyrmco.supabase.co
- เชื่อมผ่าน **Supabase MCP (OAuth)** — ก่อน migration ทุกครั้งต้อง
  `get_project_url` เทียบกับ `.env.local` ก่อนเสมอ
- ทุก schema change = ไฟล์ `supabase/migrations/<timestamp>_<name>.sql`
  **และ** apply ผ่าน MCP `apply_migration` → รัน `get_advisors` (security +
  performance) → `generate_typescript_types` → `lib/database.types.ts`

## Data model (public schema)

- `profiles` — 1:1 กับ auth.users ผ่าน trigger `handle_new_user` (role default
  `staff` เสมอ ห้ามเชื่อ client metadata; โปรโมตเป็น admin ทาง SQL/dashboard เท่านั้น)
- `customer_groups` — name, `slug` (ใช้ใน URL ของ QR), `password_hash`
  (pgcrypto bf), `password_version` (เปลี่ยนรหัส ⇒ +1 ⇒ cookie เก่าใช้ไม่ได้ทันที),
  `is_active`
- `product_categories` — name, sort_order
- `products` — category_id, name, `unit` (กก./ชิ้น/…), is_active
- `product_tiers` — ขั้นราคาตามปริมาณ (optional ต่อสินค้า): label, min_qty, max_qty
- `price_lists` — รอบราคาต่อกลุ่ม: status `draft|scheduled|published|archived`,
  publish_at, published_at, note, created_by
- `price_list_items` — price_list_id, product_id, tier_id (null = ราคาฐาน), price
  (unique nulls not distinct บน 3 คอลัมน์แรก)
- `group_access_attempts` — log + rate-limit การเดารหัสกลุ่ม (prune ด้วย pg_cron)

**ราคาปัจจุบัน/ก่อนหน้า** ไม่มีตารางแยก — window function (`row_number` +
`lead`) บน items ของ price_lists ที่ `published` ต่อ (product, tier) ล่าสุด/รองล่าสุด

### การเข้าถึงข้อมูล

- RLS เปิดทุกตาราง นโยบายแยกต่อ action (`to authenticated` +
  `(select public.is_admin())`) — **anon ไม่มีสิทธิ์ select ตารางใดเลย**
- ฝั่งลูกค้าอ่านผ่าน **SECURITY DEFINER RPC เท่านั้น** (grant ให้ anon เฉพาะ):
  - `verify_group_password(slug, password, client_key)` — rate-limited
    (นับ fail ต่อ slug และต่อ client_key ใน 15 นาที) คืน `{group_id, name, password_version}`
  - `get_group_overview(group_id, password_version)` — เช็ค active + version
    ตรงก่อนเสมอ คืน jsonb: ชื่อกลุ่ม, published_at, items (ราคา + prev_price)
  - `get_price_history(group_id, password_version, product_id, tier_id)` — 30 จุดล่าสุด
- Admin เขียนผ่าน RPC transaction เดียว: `admin_set_group_password`,
  `save_price_list(group, items jsonb, action, publish_at, note, list_id?)`
- ตั้งเวลาเผยแพร่: **pg_cron ทุกนาที** flip `scheduled→published` เมื่อ
  `publish_at <= now()` (pg_cron เป็น UTC — เวลาไทย = UTC+7)

### Customer session (ไม่ใช่ Supabase Auth)

Cookie `kp_group_session` = payload `{gid, ver, exp}` เซ็น HMAC-SHA256 ด้วย
`GROUP_SESSION_SECRET` (`lib/group-session.ts`) อายุ 7 วัน ออกโดย
`POST /api/group-login` (เขียน cookie **ลงบน response object** — bug #2 ใน
skill auth) ทุกครั้งที่หน้า `/p/[slug]` render จะเรียก RPC ซึ่งเช็ค version/active
กับ DB เสมอ — เปลี่ยนรหัสหรือปิดกลุ่ม = ตัดสิทธิ์ทันที

## Routes

- `/login` — admin email+password (browser client)
- `/admin` dashboard · `/admin/groups` · `/admin/products` · `/admin/pricing` ·
  `/admin/history`
- `/p/[slug]` — หน้า ลูกค้า: ยังไม่มี session → ฟอร์มรหัสผ่าน; มีแล้ว → กระดานราคา
  (ห้ามมี `loading.tsx` บน segment นี้ — ต้องได้ 404 จริงเมื่อ slug ผิด)
- `/api/group-login` — ออก cookie กลุ่ม; `/api/group-logout` — ลบ cookie

`proxy.ts`: gate ทุกอย่างยกเว้น `/login`, `/p/*`, `/api/*` (ห้าม redirect
API ไปหน้า login เด็ดขาด) ใช้ `getClaims()` ไม่ใช่ `getUser()` ต่อ request

## Design system

โทน "โรงรับซื้อ/โลหะ" — เขียวเข้มอมเทา + ส้มทองแดงเป็น accent, token ตาม
`thai-saas-ui-kit` (canvas/ink/card/line/brand/brand-sidebar/accent/muted +
status pairs) มีค่า light + dark ครบตั้งแต่แรก ลูกศรราคา: ขึ้น
`--price-up` (เขียว), ลง `--price-down` (แดง), คงที่ muted — ต้องผ่าน contrast
ทั้งสอง theme · desktop sidebar ↔ mobile bottom nav 5 ช่อง (ช่องกลาง =
"ตั้งราคา" ปุ่มยกนูน)

## Conventions (hard rules)

- ทุก Supabase call ต้อง destructure และเช็ค `error` — เงียบ = ไม่ยอมรับ
- ทุก list query `.order()` + `.range()` (PostgREST cap 1,000 แถวแบบเงียบ)
- ทุก data view มี 4 สถานะ: skeleton / error+retry / empty / success
- ปุ่ม mutation: disabled + spinner ระหว่าง pending; แจ้งผลด้วย sonner ภาษาไทย
- ไฟล์เล็ก (< 800 บรรทัด) แยกตาม feature; ชื่อร้าน/ข้อความคงที่ใน `lib/constants.ts`
- `tsc --noEmit` และ `next build` ต้องเขียวก่อน commit; conventional commits
- ห้าม commit secrets — `.env.local` gitignored; `GROUP_SESSION_SECRET`
  generate ครั้งเดียวต่อ deployment แล้ว copy ไป Vercel env
- `next.config.mjs` มี `allowedDevOrigins` ครบ (localhost/127.0.0.1/*.localhost)

## Build phases

- [x] Phase 1 — migrations + RLS + RPCs + pg_cron + seed admin + types
- [x] Phase 2 — scaffold app, auth (login/proxy gate), app shell + tokens
- [x] Phase 3 — admin CRUD: groups (+QR+password), categories/products/tiers
- [x] Phase 4 — pricing editor (draft/publish/schedule) + history
- [x] Phase 5 — customer board `/p/[slug]` (password gate, search, arrows, trend card, sparkline)
- [ ] Phase 6 (ภายหลัง) — PWA + web push แจ้งราคาใหม่, PDF ใบราคา A4 (react-pdf-thai), realtime broadcast, E2E Playwright

## Env vars (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://miapttbegcccferyrmco.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # จาก MCP get_publishable_keys
GROUP_SESSION_SECRET=<random 32 bytes hex — generate แล้วห้ามเปลี่ยนพร่ำเพรื่อ>
```
