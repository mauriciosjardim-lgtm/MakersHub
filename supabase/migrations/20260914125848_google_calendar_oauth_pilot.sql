-- Private integration storage: no browser role has grants or policies.
create table public.google_calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  generation uuid not null,
  status text not null check (status in ('pending', 'connected', 'revoking', 'reconnect_required')),
  tokens_ciphertext text,
  google_email text,
  updated_at timestamptz not null default now(),
  refresh_lock uuid,
  refresh_lock_until timestamptz,
  check (status <> 'connected' or tokens_ciphertext is not null)
);
create index google_calendar_connections_empresa_idx on public.google_calendar_connections(empresa_id);

create table public.google_calendar_oauth_states (
  state_hash text primary key,
  browser_hash text not null,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  session_id uuid not null references auth.sessions(id) on delete cascade,
  generation uuid not null,
  verifier_ciphertext text not null,
  expires_at timestamptz not null
);
create index google_calendar_oauth_states_empresa_idx on public.google_calendar_oauth_states(empresa_id);
create index google_calendar_oauth_states_session_idx on public.google_calendar_oauth_states(session_id);
create index google_calendar_oauth_states_expiry_idx on public.google_calendar_oauth_states(expires_at);

alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_oauth_states enable row level security;
revoke all on public.google_calendar_connections, public.google_calendar_oauth_states from public, anon, authenticated;
grant select, insert, update, delete on public.google_calendar_connections, public.google_calendar_oauth_states to service_role;

-- The callback has no bearer token. Revalidate the initiating session and current
-- tenant membership without exposing auth.sessions through the Data API.
create function public.google_calendar_session_active(p_user_id uuid, p_empresa_id uuid, p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.sessions s
    join auth.users a on a.id = s.user_id
    join public.usuarios u on u.id = a.id
    where s.id = p_session_id and s.user_id = p_user_id and u.empresa_id = p_empresa_id
      and (s.not_after is null or s.not_after > now())
      and a.email_confirmed_at is not null
      and (a.banned_until is null or a.banned_until < now())
      and a.deleted_at is null
  );
$$;
revoke all on function public.google_calendar_session_active(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.google_calendar_session_active(uuid,uuid,uuid) to service_role;

-- Start/restart a pending attempt atomically, without overwriting a live grant.
create function public.google_calendar_begin_oauth(
  p_state_hash text, p_browser_hash text, p_user_id uuid, p_empresa_id uuid,
  p_session_id uuid, p_generation uuid, p_verifier_ciphertext text, p_expires_at timestamptz
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.google_calendar_session_active(p_user_id, p_empresa_id, p_session_id) then
    raise exception 'Invalid session';
  end if;
  insert into public.google_calendar_connections(user_id, empresa_id, generation, status)
  values (p_user_id, p_empresa_id, p_generation, 'pending')
  on conflict (user_id) do update set empresa_id=excluded.empresa_id, generation=excluded.generation,
    status='pending', updated_at=now()
  where google_calendar_connections.status='pending';
  if not found then raise exception 'Disconnect before reconnecting'; end if;
  delete from public.google_calendar_oauth_states where expires_at < now();
  insert into public.google_calendar_oauth_states
    (state_hash,browser_hash,user_id,empresa_id,session_id,generation,verifier_ciphertext,expires_at)
  values (p_state_hash,p_browser_hash,p_user_id,p_empresa_id,p_session_id,p_generation,p_verifier_ciphertext,p_expires_at)
  on conflict (user_id) do update set state_hash=excluded.state_hash,browser_hash=excluded.browser_hash,
    empresa_id=excluded.empresa_id,session_id=excluded.session_id,generation=excluded.generation,
    verifier_ciphertext=excluded.verifier_ciphertext,expires_at=excluded.expires_at;
end;
$$;
revoke all on function public.google_calendar_begin_oauth(text,text,uuid,uuid,uuid,uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.google_calendar_begin_oauth(text,text,uuid,uuid,uuid,uuid,text,timestamptz) to service_role;
