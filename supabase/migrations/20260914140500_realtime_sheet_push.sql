-- Real-time path for direct Google Sheets edits.
-- Apps Script pushes a webhook the moment a cell changes, and every tracker
-- write broadcasts a contentless ping so open dashboards refresh immediately.

-- A webhook-driven run must not wait for the 50 second idle cooldown that
-- iap_sync_finish sets after a healthy cycle.
drop function if exists public.iap_sync_acquire(uuid);
create function public.iap_sync_acquire(p_token uuid, p_force boolean default false)
returns jsonb language plpgsql set search_path='' as $$
declare s public.iap_sync_state;
begin
 update public.iap_sync_state set lease_token=p_token,lease_until=now()+interval '5 minutes'
 where id
  -- Forcing skips the idle cooldown only. Failure backoff still applies, so a
  -- broken mirror is never hammered by a burst of sheet edits.
  and (next_run_at<=now() or (p_force and failures=0))
  and (lease_until is null or lease_until<now())
 returning * into s;
 if not found then return null; end if;
 return to_jsonb(s);
end $$;
revoke all on function public.iap_sync_acquire(uuid,boolean) from public,anon,authenticated;
grant execute on function public.iap_sync_acquire(uuid,boolean) to service_role;

-- The ping carries no row data. The browser learns only that something changed
-- and re-renders through the server, which still applies branch filtering, so
-- this cannot leak another station's rows the way table replication would.
create function public.iap_broadcast_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 begin
  perform realtime.send(jsonb_build_object('at',now()),'changed','iap-tracker',true);
 exception when others then
  -- Broadcast is best effort; it must never roll back the write that fired it.
  null;
 end;
 return null;
end $$;
revoke all on function public.iap_broadcast_change() from public,anon,authenticated;

-- Statement level, so both app mutations and sync imports are covered without
-- touching iap_mutate or iap_sync_apply.
create trigger iap_tracker_broadcast
after insert or update or delete on public.iap_tracker
for each statement execute function public.iap_broadcast_change();

-- Signed-in users may receive this one topic and nothing else.
drop policy if exists "iap_tracker_broadcast_receive" on realtime.messages;
create policy "iap_tracker_broadcast_receive" on realtime.messages
for select to authenticated
using (realtime.topic()='iap-tracker' and extension='broadcast');
