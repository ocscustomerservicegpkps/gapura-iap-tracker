create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create schema if not exists iap_private;
revoke all on schema iap_private from public,anon,authenticated;
grant usage on schema iap_private to service_role;
-- Vault access is narrowly scoped to this service-only background worker.
create function iap_private.sync_config(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare expected text; config jsonb;
begin
 select decrypted_secret into expected from vault.decrypted_secrets where name='iap_sync_token';
 if expected is null or p_token is null or
  extensions.digest(p_token,'sha256')<>extensions.digest(expected,'sha256') then return null; end if;
 select decrypted_secret::jsonb into config from vault.decrypted_secrets where name='iap_google_mirror';
 return config;
end $$;
revoke all on function iap_private.sync_config(text) from public,anon,authenticated;
grant execute on function iap_private.sync_config(text) to service_role;
create function public.iap_sync_config(p_token text) returns jsonb
language sql set search_path='' as $$ select iap_private.sync_config(p_token); $$;
revoke all on function public.iap_sync_config(text) from public,anon,authenticated;
grant execute on function public.iap_sync_config(text) to service_role;
-- Scheduling is activated by the setup script only after the first verified import.
