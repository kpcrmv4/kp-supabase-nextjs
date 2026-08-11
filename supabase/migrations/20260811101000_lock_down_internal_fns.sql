-- Internal functions must not be callable through PostgREST.
-- (Customer-facing RPCs verify_group_password / get_group_overview /
--  get_price_history stay anon-executable BY DESIGN — they are the public API
--  and each one validates group + password_version internally.)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
