-- Makers Members — autenticação por usuário e senha
-- Execute depois de portal_cliente_migration.sql.

create table if not exists public.portal_client_users (
  id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid not null references public.clientes_comercial(id) on delete cascade,
  nome text not null,
  email text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  last_access_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists portal_client_users_email_idx
  on public.portal_client_users (lower(email));
create index if not exists portal_client_users_cliente_idx
  on public.portal_client_users (cliente_id);

alter table public.portal_client_users enable row level security;

drop policy if exists "equipe gerencia usuarios do portal" on public.portal_client_users;
create policy "equipe gerencia usuarios do portal"
on public.portal_client_users
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.empresa_id = portal_client_users.empresa_id
  )
);

drop policy if exists "cliente visualiza proprio usuario" on public.portal_client_users;
create policy "cliente visualiza proprio usuario"
on public.portal_client_users
for select
to authenticated
using (id = auth.uid());

update auth.users au
set raw_app_meta_data =
  coalesce(au.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('account_type', 'client_portal')
where exists (
  select 1 from public.portal_client_users pcu where pcu.id = au.id
);

-- Uma identidade não pode atuar simultaneamente como membro interno e cliente.
-- Os dois triggers protegem tanto o UUID do Auth quanto o e-mail normalizado.
create or replace function public.guard_portal_client_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.usuarios u
    where u.id = new.id
       or lower(u.email) = lower(new.email)
  ) then
    raise exception using
      errcode = '23505',
      message = 'Este usuário já pertence à equipe interna';
  end if;

  return new;
end;
$$;

drop trigger if exists portal_client_users_identity_guard
  on public.portal_client_users;
create trigger portal_client_users_identity_guard
before insert or update of id, email
on public.portal_client_users
for each row
execute function public.guard_portal_client_identity();

create or replace function public.guard_internal_user_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.portal_client_users pcu
    where pcu.id = new.id
       or lower(pcu.email) = lower(new.email)
  ) then
    raise exception using
      errcode = '23505',
      message = 'Este usuário já possui acesso ao portal de cliente';
  end if;

  return new;
end;
$$;

drop trigger if exists usuarios_portal_identity_guard on public.usuarios;
create trigger usuarios_portal_identity_guard
before insert or update of id, email
on public.usuarios
for each row
execute function public.guard_internal_user_identity();

-- Evita que contas do portal sejam cadastradas como membros da produtora.
-- app_metadata é a classificação protegida; user_metadata funciona apenas como
-- sinal antecipado devido ao timing do GoTrue e nunca concede acesso. O vínculo
-- em portal_client_users é criado exclusivamente pela API com service role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_empresa_id uuid;
  v_convite equipe_convites%rowtype;
begin
  -- O GoTrue pode gravar app_metadata num UPDATE posterior ao INSERT.
  -- user_metadata só evita o trial indevido; nunca concede acesso ao portal.
  if coalesce(
    new.raw_app_meta_data->>'account_type',
    new.raw_user_meta_data->>'account_type'
  ) = 'client_portal' then
    return new;
  end if;

  select * into v_convite
  from public.equipe_convites
  where lower(email) = lower(new.email)
    and status = 'pendente'
    and expira_em > now()
  order by criado_em desc
  limit 1
  for update;

  if found then
    perform set_config('app.bypass_guard', 'on', true);
    insert into public.usuarios (id, empresa_id, nome, email, role, permissoes)
    values (
      new.id,
      v_convite.empresa_id,
      coalesce(new.raw_user_meta_data->>'nome', v_convite.nome, split_part(new.email, '@', 1)),
      new.email,
      v_convite.role,
      v_convite.permissoes
    );
    update public.equipe_convites set status = 'aceito' where id = v_convite.id;
    return new;
  end if;

  insert into public.empresas (nome, accent_color, trial_expires_at)
  values (
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    'oklch(0.88 0.22 130)',
    now() + interval '7 days'
  )
  returning id into v_empresa_id;

  insert into public.usuarios (id, empresa_id, nome, email)
  values (
    new.id,
    v_empresa_id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$function$;

create or replace function public.meu_portal_token()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token text;
  v_cliente_id uuid;
begin
  select c.portal_token, c.id into v_token, v_cliente_id
  from public.portal_client_users pcu
  join public.clientes_comercial c
    on c.id = pcu.cliente_id
   and c.empresa_id = pcu.empresa_id
  where pcu.id = auth.uid()
    and pcu.status = 'active'
    and c.portal_enabled = true
    and c.portal_token is not null;

  if v_token is not null then
    update public.portal_client_users
    set last_access_at = now(), updated_at = now()
    where id = auth.uid();

    update public.clientes_comercial
    set portal_last_access_at = now()
    where id = v_cliente_id;
  end if;

  return v_token;
end;
$$;

revoke all on function public.portal_cliente_publico(text) from anon;
revoke all on function public.responder_revisao_portal(text, uuid, text, text, text) from anon;
revoke all on function public.meu_portal_token() from public;
grant execute on function public.meu_portal_token() to authenticated;
