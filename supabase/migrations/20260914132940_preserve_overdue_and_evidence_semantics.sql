create or replace function public.iap_parse_date(raw text) returns date
language plpgsql immutable set search_path='' as $$
declare p text[]; m integer;
begin
 if trim(raw) ~ '^\d{4}-\d{2}-\d{2}$' then return trim(raw)::date; end if;
 p:=regexp_match(lower(trim(raw)),'^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})$');
 if p is null or p[3]::integer<100 then return null; end if;
 m:=('{"jan":1,"januari":1,"january":1,"feb":2,"februari":2,"february":2,"mar":3,"maret":3,"march":3,"apr":4,"april":4,"mei":5,"may":5,"jun":6,"juni":6,"june":6,"jul":7,"juli":7,"july":7,"agu":8,"agustus":8,"aug":8,"august":8,"sep":9,"september":9,"okt":10,"oktober":10,"oct":10,"october":10,"nov":11,"november":11,"des":12,"desember":12,"dec":12,"december":12}'::jsonb->>p[2])::integer;
 if m is null then return null; end if;
 return make_date(p[3]::integer,m,p[1]::integer);
exception when others then return null;
end $$;
-- Mirrors the viewer URL normalization used by src/domain/evidence.ts.
create function public.iap_view_link(raw text) returns text
language plpgsql immutable set search_path='' as $$
declare p text[]; v text:=trim(raw);
begin
 if v !~* '^https?://[^/[:space:]]+' then return ''; end if;
 p:=regexp_match(v,'^https?://docs\.google\.com(?::[0-9]+)?/(document|spreadsheets|presentation|drawings)/d/([^/?#]+)','i');
 if p is not null then return 'https://docs.google.com/'||p[1]||'/d/'||p[2]||'/preview'; end if;
 p:=regexp_match(v,'^https?://drive\.google\.com(?::[0-9]+)?/file/d/([^/?#]+)','i');
 if p is not null then return 'https://drive.google.com/file/d/'||p[1]||'/view'; end if;
 return v;
end $$;
create function public.iap_merge_evidence(stored text,submitted text) returns text
language sql immutable set search_path='' as $$
 select coalesce(string_agg(link,E'\n' order by first_seen),'') from (
  select public.iap_view_link(value) link,min(ord) first_seen
  from regexp_split_to_table(coalesce(stored,'')||E'\n'||coalesce(submitted,''),E'\n')
    with ordinality as v(value,ord)
  where public.iap_view_link(value)<>'' group by public.iap_view_link(value)
 ) links;
$$;
revoke all on function public.iap_view_link(text),public.iap_merge_evidence(text,text) from public,anon,authenticated;
grant execute on function public.iap_view_link(text),public.iap_merge_evidence(text,text) to service_role;
alter function public.iap_record(jsonb) stable;
create or replace function public.iap_mutate(p_operation text,p_payload jsonb,p_today date)
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
   evidence_link=public.iap_merge_evidence(evidence_link,s->>'evidenceLink')
  where iap_id=v_id and step_no=(p_payload->>'stepNo')::integer;
  if not found then raise exception 'Item % tidak ditemukan.',v_id; end if;
 elsif p_operation='append_evidence' then
  v_link:=p_payload->>'link';
  for s in select value from jsonb_array_elements(p_payload->'keys') loop
   update public.iap_tracker set evidence_link=public.iap_merge_evidence(evidence_link,v_link)
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
 -- Heal N using the same Jakarta date supplied by the application.
 update public.iap_tracker set stored_overdue=case
  when status='Selesai' then '-'
  when public.iap_parse_date(target_date)<p_today then 'TERLAMBAT' else 'Sesuai Rencana' end
 where (iap_id=v_id or p_operation='append_evidence' and
   exists(select 1 from jsonb_array_elements(p_payload->'keys') k
    where k->>'iapId'=iap_id and (k->>'stepNo')::integer=step_no));
 -- Indonesian dates stay text for exact Sheets compatibility. Parse safely in the client;
 -- the client supplies healed N for step saves using the same Jakarta date logic.
 if p_payload ? 'overdue' then
  update public.iap_tracker set stored_overdue=p_payload->>'overdue'
   where iap_id=v_id and step_no=(p_payload->>'stepNo')::integer;
 end if;
 return jsonb_build_object('ok',true);
end $$;
