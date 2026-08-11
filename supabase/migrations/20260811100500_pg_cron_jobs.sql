-- pg_cron: publish scheduled price lists + prune the attempt log.
-- pg_cron runs in UTC (Thai time = UTC+7).
create extension if not exists pg_cron;

-- Every minute: flip scheduled -> published when publish_at is due.
select cron.schedule('publish-due-price-lists', '* * * * *',
  $$ select public.publish_due_price_lists() $$);

-- Daily 03:00 Thai (20:00 UTC): prune access attempts older than 2 days.
select cron.schedule('prune-group-access-attempts', '0 20 * * *',
  $$ delete from public.group_access_attempts where created_at < now() - interval '2 days' $$);
