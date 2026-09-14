-- Run inside BEGIN / ROLLBACK with the migration applied. This probe uses only
-- synthetic state/ciphertext for the configured pilot, never real Google tokens.
do $$
declare
  pilot uuid := 'c88dae71-5946-4e75-a3db-c0dd26fe0dd1';
  tenant uuid;
  sid uuid;
  generation uuid := gen_random_uuid();
  next_generation uuid := gen_random_uuid();
  consumed integer;
  blocked boolean := false;
begin
  if exists (select 1 from public.google_calendar_connections where user_id=pilot) then
    raise exception 'Probe requires a pilot without an existing Google connection';
  end if;
  select empresa_id into strict tenant from public.usuarios where id=pilot;
  select id into sid from auth.sessions where user_id=pilot and (not_after is null or not_after>now()) limit 1;
  if sid is null then raise exception 'Pilot has no active test session'; end if;
  if not public.google_calendar_session_active(pilot,tenant,sid) then raise exception 'Valid session rejected'; end if;
  if public.google_calendar_session_active(pilot,gen_random_uuid(),sid) then raise exception 'Wrong tenant accepted'; end if;
  if public.google_calendar_session_active(pilot,tenant,gen_random_uuid()) then raise exception 'Missing session accepted'; end if;

  perform public.google_calendar_begin_oauth('test-state','test-browser',pilot,tenant,sid,generation,'TEST-NOT-A-SECRET',now()+interval '10 minutes');
  delete from public.google_calendar_oauth_states where state_hash='test-state' and browser_hash='wrong-browser' and expires_at>now();
  get diagnostics consumed=row_count;
  if consumed<>0 then raise exception 'Wrong browser consumed state'; end if;
  delete from public.google_calendar_oauth_states where state_hash='test-state' and browser_hash='test-browser' and expires_at>now();
  get diagnostics consumed=row_count;
  if consumed<>1 then raise exception 'Expected one state consumption'; end if;
  delete from public.google_calendar_oauth_states where state_hash='test-state' and browser_hash='test-browser' and expires_at>now();
  get diagnostics consumed=row_count;
  if consumed<>0 then raise exception 'Replay consumed state'; end if;

  perform public.google_calendar_begin_oauth('expired','test-browser',pilot,tenant,sid,next_generation,'TEST-NOT-A-SECRET',now()-interval '1 minute');
  delete from public.google_calendar_oauth_states where state_hash='expired' and expires_at>now();
  get diagnostics consumed=row_count;
  if consumed<>0 then raise exception 'Expired attempt accepted'; end if;
  update public.google_calendar_connections set status='connected',tokens_ciphertext='TEST-NOT-A-TOKEN' where user_id=pilot;
  begin
    perform public.google_calendar_begin_oauth('overwrite','test-browser',pilot,tenant,sid,generation,'TEST-NOT-A-SECRET',now()+interval '10 minutes');
  exception when raise_exception then blocked:=true;
  end;
  if not blocked then raise exception 'A new attempt overwrote connected credentials'; end if;

  if has_function_privilege('authenticated','public.google_calendar_session_active(uuid,uuid,uuid)','EXECUTE')
    or has_function_privilege('anon','public.google_calendar_session_active(uuid,uuid,uuid)','EXECUTE') then
    raise exception 'Session probe exposed to browser roles';
  end if;
end;
$$;

set local role authenticated;
do $$
begin
  begin
    perform 1 from public.google_calendar_connections;
    raise exception 'Authenticated role can read credentials';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.google_calendar_oauth_states;
    raise exception 'Authenticated role can mutate OAuth states';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.google_calendar_session_active(null,null,null);
    raise exception 'Authenticated role can call session probe';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.google_calendar_connections;
    raise exception 'Anonymous role can read credentials';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
