drop function public.iap_sync_finish(uuid,jsonb,text);
create function public.iap_sync_finish(p_token uuid,p_baseline jsonb,p_error text default null,p_retry_after_seconds integer default 0)
returns void language plpgsql set search_path='' as $$
begin
 update public.iap_sync_state set
  baseline=case when p_error is null then p_baseline else baseline end,
  initialized=initialized or p_error is null,
  last_success_at=case when p_error is null then now() else last_success_at end,
  last_error=p_error, failures=case when p_error is null then 0 else failures+1 end,
  next_run_at=now()+case when p_error is null then interval '50 seconds'
    else greatest(coalesce(p_retry_after_seconds,0),least(3600,60*power(2,least(failures,6)))) * interval '1 second' end,
  lease_token=null,lease_until=null
 where id and lease_token=p_token;
 if not found then raise exception 'Sync lease lost'; end if;
end $$;

revoke all on function public.iap_sync_finish(uuid,jsonb,text,integer) from public,anon,authenticated;
grant execute on function public.iap_sync_finish(uuid,jsonb,text,integer) to service_role;
