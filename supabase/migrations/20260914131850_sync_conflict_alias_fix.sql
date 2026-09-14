create or replace function public.iap_sync_apply(p_token uuid,p_changes jsonb,p_conflicts jsonb)
returns void language plpgsql set search_path='' as $$
declare x jsonb; r public.iap_tracker; current_version bigint;
begin
 perform pg_advisory_xact_lock(74109211);
 if not exists(select 1 from public.iap_sync_state where id and lease_token=p_token and lease_until>now())
 then raise exception 'Sync lease expired'; end if;
 for x in select value from jsonb_array_elements(p_changes) loop
  select version into current_version from public.iap_tracker
   where iap_id=x->>'iapId' and step_no=(x->>'stepNo')::integer for update;
  if current_version is distinct from (x->>'version')::bigint then
   raise exception 'Sync snapshot changed; retry next run';
  end if;
  if x->'cells'='null'::jsonb then
   delete from public.iap_tracker where iap_id=x->>'iapId' and step_no=(x->>'stepNo')::integer;
  else
   r:=public.iap_record(x->'cells');
   insert into public.iap_tracker select r.*
   on conflict(iap_id,step_no) do update set
    no=excluded.no,title=excluded.title,station=excluded.station,step=excluded.step,action=excluded.action,pic=excluded.pic,timeline=excluded.timeline,target_date=excluded.target_date,status=excluded.status,progress=excluded.progress,actual_date=excluded.actual_date,stored_overdue=excluded.stored_overdue,evidence=excluded.evidence,context_note=excluded.context_note,evidence_link=excluded.evidence_link,incident=excluded.incident,parties=excluded.parties,purpose=excluded.purpose,effective_date=excluded.effective_date,root_cause=excluded.root_cause,kpis=excluded.kpis;
  end if;
 end loop;
 insert into public.iap_sync_conflicts(iap_id,step_no,column_name,baseline,sheets_value,supabase_value)
 select j.value->>'iapId',(j.value->>'stepNo')::integer,j.value->>'column',j.value->'baseline',j.value->'sheet',j.value->'database'
 from jsonb_array_elements(p_conflicts) as j(value);
end $$;
