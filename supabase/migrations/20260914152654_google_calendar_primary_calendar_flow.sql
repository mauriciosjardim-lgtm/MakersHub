-- Version 2 migrates the pilot from its dedicated test calendar to the user's
-- primary Google calendar. The cutoff prevents the first run from importing an
-- unbounded personal history. A calendar switch requires the normal sync lease
-- and replaces the old mappings atomically before new events are enrolled.
alter table public.google_calendar_sync_settings
 add column sync_from timestamptz not null default date_trunc('day', now()),
 add column configuration_version smallint not null default 1
  check (configuration_version between 1 and 2);

create or replace function public.google_calendar_sync_write(
 p_user uuid, p_empresa uuid, p_session uuid, p_generation uuid,
 p_lease uuid, p_action text, p_data jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.google_calendar_sync_settings; l public.google_calendar_event_links;
 e public.eventos; v jsonb; lid uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text, 814));
 if not public.google_calendar_session_active(p_user,p_empresa,p_session) or not exists (
  select 1 from public.google_calendar_connections c where c.user_id=p_user and c.empresa_id=p_empresa
  and c.generation=p_generation and c.status='connected'
 ) then raise exception 'access_denied'; end if;
 select * into s from public.google_calendar_sync_settings where user_id=p_user and empresa_id=p_empresa for update;
 if p_action='configure' then
  if p_data->>'calendar_id' is null or p_data->>'calendar_name' is null or
     p_data->>'time_zone' is null or p_data->>'sync_from' is null or
     (p_data->>'configuration_version')::smallint<>2 then
   raise exception 'invalid_action';
  end if;
  if s.user_id is null then
   insert into public.google_calendar_sync_settings(
    user_id,empresa_id,calendar_id,calendar_name,time_zone,sync_from,configuration_version
   ) values(
    p_user,p_empresa,p_data->>'calendar_id',p_data->>'calendar_name',p_data->>'time_zone',
    (p_data->>'sync_from')::timestamptz,2
   );
  elsif s.calendar_id<>p_data->>'calendar_id' or s.time_zone<>p_data->>'time_zone' or
        s.configuration_version<2 then
   if s.lease is distinct from p_lease or s.lease_until<=now() then
    raise exception 'sync_in_progress';
   end if;
   delete from public.google_calendar_event_links
    where user_id=p_user and empresa_id=p_empresa;
   update public.google_calendar_sync_settings set
    calendar_id=p_data->>'calendar_id', calendar_name=p_data->>'calendar_name',
    time_zone=p_data->>'time_zone', sync_from=(p_data->>'sync_from')::timestamptz,
    configuration_version=2, last_synced_at=null
    where user_id=p_user and empresa_id=p_empresa;
  else
   update public.google_calendar_sync_settings set calendar_name=p_data->>'calendar_name'
    where user_id=p_user and empresa_id=p_empresa;
  end if;
  return '{}'::jsonb;
 end if;
 if s.user_id is null then raise exception 'calendar_required'; end if;
 if p_action='enroll' then
  select * into e from public.eventos where id=(p_data->>'local_event_id')::uuid and empresa_id=p_empresa and ref_tipo is null for update;
  if e.id is null then raise exception 'event_not_eligible'; end if;
  if (select count(*) from public.google_calendar_event_links where user_id=p_user)>=300 then raise exception 'calendar_limit'; end if;
  insert into public.google_calendar_event_links(id,user_id,empresa_id,calendar_id,local_event_id,google_event_id)
  values((p_data->>'id')::uuid,p_user,p_empresa,s.calendar_id,e.id,p_data->>'google_event_id')
  on conflict(user_id,local_event_id) do nothing;
  return '{}'::jsonb;
 end if;
 if p_action='claim' then
  if s.lease_until>now() then raise exception 'sync_in_progress'; end if;
  update public.google_calendar_sync_settings set lease=p_lease,lease_until=now()+interval '120 seconds' where user_id=p_user;
  return to_jsonb(s);
 end if;
 if s.lease is distinct from p_lease or s.lease_until<=now() then raise exception 'sync_in_progress'; end if;
 if p_action='release' then
  update public.google_calendar_sync_settings set lease=null,lease_until=null,
   last_synced_at=case when (p_data->>'complete')::boolean then now() else last_synced_at end where user_id=p_user;
  return '{}'::jsonb;
 end if;
 if p_action='import' then
  if (select count(*) from public.google_calendar_event_links where user_id=p_user)>=300 then raise exception 'calendar_limit'; end if;
  if exists(select 1 from public.google_calendar_event_links where user_id=p_user and calendar_id=s.calendar_id and google_event_id=p_data->>'google_event_id') then return '{}'::jsonb; end if;
  v:=p_data->'event'; lid:=(p_data->>'local_event_id')::uuid;
  insert into public.eventos(id,empresa_id,titulo,descricao,local,inicio,fim,dia_todo,tipo)
  values(lid,p_empresa,v->>'titulo',v->>'descricao',v->>'local',(v->>'inicio')::timestamptz,(v->>'fim')::timestamptz,(v->>'dia_todo')::boolean,'outro');
  insert into public.google_calendar_event_links(id,user_id,empresa_id,calendar_id,local_event_id,google_event_id,base,pending)
  values((p_data->>'id')::uuid,p_user,p_empresa,s.calendar_id,lid,p_data->>'google_event_id',p_data->'base',false);
  return '{}'::jsonb;
 end if;
 select * into l from public.google_calendar_event_links where id=(p_data->>'id')::uuid and user_id=p_user and empresa_id=p_empresa and calendar_id=s.calendar_id for update;
 if l.id is null then raise exception 'event_not_eligible'; end if;
 if p_action='heartbeat' then
  select * into e from public.eventos where id=l.local_event_id and empresa_id=p_empresa;
  if e.calendar_revision is distinct from (p_data->>'revision')::bigint then raise exception 'event_changed'; end if;
  return '{}'::jsonb;
 end if;
 if p_action='remap' then
  update public.google_calendar_event_links set google_event_id=p_data->>'google_event_id',pending=true where id=l.id;
  return '{}'::jsonb;
 end if;
 if p_action='apply' then
  select * into e from public.eventos where id=l.local_event_id and empresa_id=p_empresa for update;
  if e.calendar_revision is distinct from (p_data->>'revision')::bigint then raise exception 'event_changed'; end if;
  v:=p_data->'event';
  if v is null or v='null'::jsonb then
   delete from public.eventos where id=l.local_event_id and empresa_id=p_empresa;
  elsif e.id is null then
   insert into public.eventos(id,empresa_id,titulo,descricao,local,inicio,fim,dia_todo,tipo)
   values(l.local_event_id,p_empresa,v->>'titulo',v->>'descricao',v->>'local',(v->>'inicio')::timestamptz,(v->>'fim')::timestamptz,(v->>'dia_todo')::boolean,'outro');
  else
   update public.eventos set titulo=v->>'titulo',descricao=v->>'descricao',local=v->>'local',inicio=(v->>'inicio')::timestamptz,
    fim=(v->>'fim')::timestamptz,dia_todo=(v->>'dia_todo')::boolean where id=e.id and empresa_id=p_empresa;
  end if;
 elsif p_action<>'ack' then raise exception 'invalid_action'; end if;
 update public.google_calendar_event_links set base=nullif(p_data->'base','null'::jsonb),pending=false,
  deleted=(p_data->'base' is null or p_data->'base'='null'::jsonb) where id=l.id;
 return '{}'::jsonb;
end $$;

revoke all on function public.google_calendar_sync_write(uuid,uuid,uuid,uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.google_calendar_sync_write(uuid,uuid,uuid,uuid,uuid,text,jsonb) to service_role;
