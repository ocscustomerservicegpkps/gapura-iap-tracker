-- Tracker A:W preserved, including legacy P and six context fields R:W.
create table public.iap_tracker (
  no integer not null default 0,
  iap_id text not null default '',
  title text not null default '',
  station text not null default '',
  step_no integer not null default 0,
  step text not null default '',
  action text not null default '',
  pic text not null default '',
  timeline text not null default '',
  target_date text not null default '',
  status text not null default 'Belum Dimulai',
  progress integer not null default 0,
  actual_date text not null default '',
  stored_overdue text not null default '',
  evidence text not null default '',
  context_note text not null default '',
  evidence_link text not null default '',
  incident text not null default '',
  parties text not null default '',
  purpose text not null default '',
  effective_date text not null default '',
  root_cause text not null default '',
  kpis text not null default '',
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (iap_id, step_no),
  check (iap_id <> '' and step_no > 0),
  check (progress between 0 and 100),
  check (status in ('Belum Dimulai','Sedang Berjalan','Selesai'))
);
create index iap_tracker_order_idx on public.iap_tracker (no, iap_id, step_no);
create table public.iap_sync_state (
  id boolean primary key default true check(id),
  baseline jsonb not null default '[]',
  initialized boolean not null default false,
  lease_token uuid, lease_until timestamptz,
  next_run_at timestamptz not null default now(),
  last_success_at timestamptz, last_error text,
  failures integer not null default 0
);
insert into public.iap_sync_state(id) values(true);
create table public.iap_sync_conflicts (
 id bigint generated always as identity primary key,
 created_at timestamptz not null default now(), iap_id text not null,
 step_no integer not null, column_name text not null,
 baseline jsonb, sheets_value jsonb, supabase_value jsonb
);
create index iap_sync_conflicts_created_idx on public.iap_sync_conflicts(created_at);
alter table public.iap_tracker enable row level security;
alter table public.iap_sync_state enable row level security;
alter table public.iap_sync_conflicts enable row level security;
revoke all on public.iap_tracker,public.iap_sync_state,public.iap_sync_conflicts from public,anon,authenticated;
grant select,insert,update,delete on public.iap_tracker,public.iap_sync_state,public.iap_sync_conflicts to service_role;
grant usage,select on sequence public.iap_sync_conflicts_id_seq to service_role;

create function public.iap_row(r public.iap_tracker) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_array(r.no,r.iap_id,r.title,r.station,r.step_no,r.step,r.action,r.pic,r.timeline,r.target_date,r.status,r.progress,r.actual_date,r.stored_overdue,r.evidence,r.context_note,r.evidence_link,r.incident,r.parties,r.purpose,r.effective_date,r.root_cause,r.kpis);
$$;
create function public.iap_record(c jsonb) returns public.iap_tracker
language sql immutable set search_path='' as $$
 select jsonb_populate_record(null::public.iap_tracker,jsonb_build_object(
 'no',coalesce((c->>0)::integer,0),
 'iap_id',coalesce(c->>1,''),
 'title',coalesce(c->>2,''),
 'station',coalesce(c->>3,''),
 'step_no',coalesce((c->>4)::integer,0),
 'step',coalesce(c->>5,''),
 'action',coalesce(c->>6,''),
 'pic',coalesce(c->>7,''),
 'timeline',coalesce(c->>8,''),
 'target_date',coalesce(c->>9,''),
 'status',coalesce(c->>10,''),
 'progress',coalesce((c->>11)::integer,0),
 'actual_date',coalesce(c->>12,''),
 'stored_overdue',coalesce(c->>13,''),
 'evidence',coalesce(c->>14,''),
 'context_note',coalesce(c->>15,''),
 'evidence_link',coalesce(c->>16,''),
 'incident',coalesce(c->>17,''),
 'parties',coalesce(c->>18,''),
 'purpose',coalesce(c->>19,''),
 'effective_date',coalesce(c->>20,''),
 'root_cause',coalesce(c->>21,''),
 'kpis',coalesce(c->>22,''),
 'version',1,'updated_at',now()));
$$;
create function public.iap_version() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' then
   if public.iap_row(new)=public.iap_row(old) then return old; end if;
   new.version:=old.version+1;
 end if;
 new.updated_at:=clock_timestamp(); return new;
end $$;
create trigger iap_tracker_version before insert or update on public.iap_tracker
for each row execute function public.iap_version();

-- Snapshot uses a single transaction and avoids PostgREST's 1000-row truncation.
create function public.iap_snapshot() returns jsonb language sql stable set search_path='' as $$
select coalesce(jsonb_agg(jsonb_build_object('cells',public.iap_row(r),'version',r.version)
 order by r.no,r.iap_id,r.step_no),'[]') from public.iap_tracker r;
$$;

create function public.iap_mutate(p_operation text,p_payload jsonb,p_today date)
returns jsonb language plpgsql set search_path='' as $$
declare
 r public.iap_tracker; c jsonb; s jsonb; n integer; v_step integer;
 v_id text:=p_payload->>'iapId'; v_link text; v_context jsonb:=p_payload->'context';
begin
 -- Serializes only brief DB transactions; never holds locks during Google calls.
 perform pg_advisory_xact_lock(74109211);
 if p_operation='create_case' then
  if exists(select 1 from public.iap_tracker where iap_id=v_id) then
   raise exception 'ID IAP % sudah digunakan oleh kasus lain.',v_id;
  end if;
  select coalesce(max(no),0) into n from public.iap_tracker;
  v_step:=0;
  for s in select value from jsonb_array_elements(p_payload->'steps') loop
   v_step:=v_step+1; n:=n+1;
   c:=jsonb_build_array(n,v_id,p_payload->>'title',p_payload->>'station',v_step,
    s->>'step',s->>'action',s->>'pic',s->>'timeline',s->>'targetDate',
    s->>'status',(s->>'progress')::integer,s->>'actualDate','',s->>'evidence','',s->>'evidenceLink',
    coalesce(v_context->>'incident',''),coalesce(v_context->>'parties',''),
    coalesce(v_context->>'purpose',''),coalesce(v_context->>'effectiveDate',''),
    coalesce(v_context->>'rootCause',''),
    coalesce((select string_agg(value,E'\n') from jsonb_array_elements_text(v_context->'kpis')),''));
   r:=public.iap_record(c); insert into public.iap_tracker select r.*;
  end loop;
 elsif p_operation='create_step' then
  select * into r from public.iap_tracker where iap_id=v_id order by no limit 1;
  if not found then raise exception 'Kasus % tidak ditemukan.',v_id; end if;
  select coalesce(max(no),0)+1 into r.no from public.iap_tracker;
  select max(step_no)+1 into r.step_no from public.iap_tracker where iap_id=v_id;
  s:=p_payload->'input';
  r.step:=s->>'step'; r.action:=s->>'action'; r.pic:=s->>'pic'; r.timeline:=s->>'timeline';
  r.target_date:=s->>'targetDate'; r.status:=s->>'status'; r.progress:=(s->>'progress')::integer;
  r.actual_date:=s->>'actualDate'; r.evidence:=s->>'evidence'; r.evidence_link:=s->>'evidenceLink';
  r.version:=1; insert into public.iap_tracker select r.*;
 elsif p_operation='update_step' then
  s:=p_payload->'input';
  update public.iap_tracker set step=s->>'step',action=s->>'action',pic=s->>'pic',
   timeline=s->>'timeline',target_date=s->>'targetDate',status=s->>'status',
   progress=(s->>'progress')::integer,actual_date=s->>'actualDate',evidence=s->>'evidence',
   evidence_link=(select coalesce(string_agg(link,E'\n'),'') from
     (select distinct value as link from regexp_split_to_table(
       evidence_link||E'\n'||coalesce(s->>'evidenceLink',''),E'\n') value where value<>'') links)
  where iap_id=v_id and step_no=(p_payload->>'stepNo')::integer;
  if not found then raise exception 'Item % tidak ditemukan.',v_id; end if;
 elsif p_operation='append_evidence' then
  v_link:=p_payload->>'link';
  for s in select value from jsonb_array_elements(p_payload->'keys') loop
   update public.iap_tracker set evidence_link=case
    when v_link=any(string_to_array(evidence_link,E'\n')) then evidence_link
    when evidence_link='' then v_link else evidence_link||E'\n'||v_link end
    where iap_id=s->>'iapId' and step_no=(s->>'stepNo')::integer;
   if not found then raise exception 'Item % langkah % tidak ditemukan.',s->>'iapId',s->>'stepNo'; end if;
  end loop;
 elsif p_operation='update_case' then
  update public.iap_tracker set title=p_payload->>'title',station=p_payload->>'station' where iap_id=v_id;
  if not found then raise exception 'Kasus % tidak ditemukan.',v_id; end if;
 elsif p_operation='context' then
  if not exists(select 1 from public.iap_tracker where iap_id=v_id) then
   raise exception 'Kasus % tidak ditemukan.',v_id;
  end if;
 elsif p_operation='delete_step' then
  delete from public.iap_tracker where iap_id=v_id and step_no=(p_payload->>'stepNo')::integer;
  if not found then raise exception 'Item % tidak ditemukan.',v_id; end if;
 elsif p_operation='delete_case' then
  delete from public.iap_tracker where iap_id=v_id;
  if not found then raise exception 'Kasus % tidak ditemukan.',v_id; end if;
 else raise exception 'Unknown operation'; end if;

 if v_context is not null then
  update public.iap_tracker set incident=coalesce(v_context->>'incident',''),
   parties=coalesce(v_context->>'parties',''),purpose=coalesce(v_context->>'purpose',''),
   effective_date=coalesce(v_context->>'effectiveDate',''),root_cause=coalesce(v_context->>'rootCause',''),
   kpis=coalesce((select string_agg(value,E'\n') from jsonb_array_elements_text(v_context->'kpis')),'')
   where iap_id=v_id;
 end if;
 -- Preserve the display sequence after structural edits without full-row rewrites.
 if p_operation in ('delete_step','delete_case','create_case','create_step') then
  update public.iap_tracker t set no=x.n from
    (select iap_id,step_no,row_number() over(order by no,iap_id,step_no)::integer n
     from public.iap_tracker) x
   where t.iap_id=x.iap_id and t.step_no=x.step_no and t.no<>x.n;
 end if;
 -- Indonesian dates stay text for exact Sheets compatibility. Parse safely in the client;
 -- the client supplies healed N for step saves using the same Jakarta date logic.
 if p_payload ? 'overdue' then
  update public.iap_tracker set stored_overdue=p_payload->>'overdue'
   where iap_id=v_id and step_no=(p_payload->>'stepNo')::integer;
 end if;
 return jsonb_build_object('ok',true);
end $$;

create function public.iap_sync_acquire(p_token uuid) returns jsonb
language plpgsql set search_path='' as $$
declare s public.iap_sync_state;
begin
 update public.iap_sync_state set lease_token=p_token,lease_until=now()+interval '5 minutes'
 where id and next_run_at<=now() and (lease_until is null or lease_until<now()) returning * into s;
 if not found then return null; end if;
 return to_jsonb(s);
end $$;

-- Compare-and-set prevents an inbound sheet edit from replacing a newer DB write.
create function public.iap_sync_apply(p_token uuid,p_changes jsonb,p_conflicts jsonb)
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
 select x->>'iapId',(x->>'stepNo')::integer,x->>'column',x->'baseline',x->'sheet',x->'database'
 from jsonb_array_elements(p_conflicts) x;
end $$;

create function public.iap_sync_finish(p_token uuid,p_baseline jsonb,p_error text default null)
returns void language plpgsql set search_path='' as $$
begin
 update public.iap_sync_state set
  baseline=case when p_error is null then p_baseline else baseline end,
  initialized=initialized or p_error is null,
  last_success_at=case when p_error is null then now() else last_success_at end,
  last_error=p_error, failures=case when p_error is null then 0 else failures+1 end,
  next_run_at=now()+case when p_error is null then interval '50 seconds'
    else least(3600,60*power(2,least(failures,6))) * interval '1 second' end,
  lease_token=null,lease_until=null
 where id and lease_token=p_token;
 if not found then raise exception 'Sync lease lost'; end if;
end $$;

-- RPCs are server-only. No SECURITY DEFINER or public client access.
revoke all on function public.iap_row(public.iap_tracker) from public,anon,authenticated;
grant execute on function public.iap_row(public.iap_tracker) to service_role;
revoke all on function public.iap_record(jsonb) from public,anon,authenticated;
grant execute on function public.iap_record(jsonb) to service_role;
revoke all on function public.iap_version() from public,anon,authenticated;
grant execute on function public.iap_version() to service_role;
revoke all on function public.iap_snapshot() from public,anon,authenticated;
grant execute on function public.iap_snapshot() to service_role;
revoke all on function public.iap_mutate(text,jsonb,date) from public,anon,authenticated;
grant execute on function public.iap_mutate(text,jsonb,date) to service_role;
revoke all on function public.iap_sync_acquire(uuid) from public,anon,authenticated;
grant execute on function public.iap_sync_acquire(uuid) to service_role;
revoke all on function public.iap_sync_apply(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.iap_sync_apply(uuid,jsonb,jsonb) to service_role;
revoke all on function public.iap_sync_finish(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.iap_sync_finish(uuid,jsonb,text) to service_role;
