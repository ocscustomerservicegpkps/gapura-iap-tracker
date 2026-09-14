create function iap_private.server_authorized(p_token text) returns boolean
language sql security definer set search_path='' as $$
select coalesce(exists(select 1 from vault.decrypted_secrets where name='iap_server_token'
 and extensions.digest(decrypted_secret,'sha256')=extensions.digest(p_token,'sha256')),false);
$$;
revoke all on function iap_private.server_authorized(text) from public,anon,authenticated;
grant execute on function iap_private.server_authorized(text) to service_role;
create function public.iap_server_authorized(p_token text) returns boolean
language sql set search_path='' as $$select iap_private.server_authorized(p_token);$$;
revoke all on function public.iap_server_authorized(text) from public,anon,authenticated;
grant execute on function public.iap_server_authorized(text) to service_role;
