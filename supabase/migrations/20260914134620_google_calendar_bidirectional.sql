-- Pilot sync metadata is accessible only to the server. Disconnect retains mappings.
alter table public.eventos add column calendar_revision bigint not null default 1;
create function public.google_calendar_event_revision() returns trigger
language plpgsql set search_path = '' as $$
begin new.calendar_revision := old.calendar_revision + 1; return new; end $$;
create trigger google_calendar_event_revision before update on public.eventos
for each row execute function public.google_calendar_event_revision();
revoke all on function public.google_calendar_event_revision() from public, anon, authenticated;

create table public.google_calendar_sync_settings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 empresa_id uuid not null references public.empresas(id) on delete cascade,
 calendar_id text not null, calendar_name text not null, time_zone text not null,
 last_synced_at timestamptz, lease uuid, lease_until timestamptz
);
create table public.google_calendar_event_links (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 empresa_id uuid not null references public.empresas(id) on delete cascade,
 calendar_id text not null, local_event_id uuid not null, google_event_id text not null,
 base jsonb, pending boolean not null default true, deleted boolean not null default false,
 unique (user_id, local_event_id), unique (user_id, calendar_id, google_event_id)
);
create index google_calendar_sync_empresa on public.google_calendar_sync_settings(empresa_id);
create index google_calendar_links_empresa on public.google_calendar_event_links(empresa_id);
alter table public.google_calendar_sync_settings enable row level security;
alter table public.google_calendar_event_links enable row level security;
revoke all on public.google_calendar_sync_settings, public.google_calendar_event_links from public, anon, authenticated;
grant select, insert, update, delete on public.google_calendar_sync_settings, public.google_calendar_event_links to service_role;

-- Every write validates the current authenticated session and connection generation.
-- Event updates and their sync baseline commit atomically, with revision comparison.
create function public.google_calendar_sync_write(
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
  if s.user_id is not null and (s.calendar_id<>p_data->>'calendar_id' or s.time_zone<>p_data->>'time_zone') then
   raise exception 'calendar_already_selected';
  end if;
  insert into public.google_calendar_sync_settings(user_id,empresa_id,calendar_id,calendar_name,time_zone)
  values(p_user,p_empresa,p_data->>'calendar_id',p_data->>'calendar_name',p_data->>'time_zone')
  on conflict(user_id) do nothing;
  return '{}'::jsonb;
 end if;
 if s.user_id is null then raise exception 'calendar_required'; end if;
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
 if p_action='enroll' then
  select * into e from public.eventos where id=(p_data->>'local_event_id')::uuid and empresa_id=p_empresa and ref_tipo is null for update;
  if e.id is null then raise exception 'event_not_eligible'; end if;
  if (select count(*) from public.google_calendar_event_links where user_id=p_user)>=300 then raise exception 'calendar_limit'; end if;
  insert into public.google_calendar_event_links(id,user_id,empresa_id,calendar_id,local_event_id,google_event_id)
  values((p_data->>'id')::uuid,p_user,p_empresa,s.calendar_id,e.id,p_data->>'google_event_id')
  on conflict(user_id,local_event_id) do nothing;
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
