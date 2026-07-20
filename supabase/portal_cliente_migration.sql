-- Makers Members — estrutura base do portal do cliente.
-- Fonte canônica do acesso: clientes_comercial.
-- Execute antes de portal_client_auth_migration.sql e
-- portal_deliveries_migration.sql.

begin;

create extension if not exists pgcrypto;

alter table public.clientes_comercial
  add column if not exists accent_color text,
  add column if not exists portal_enabled boolean not null default false,
  add column if not exists portal_token text,
  add column if not exists portal_welcome_message text,
  add column if not exists portal_last_access_at timestamptz;

create unique index if not exists clientes_comercial_portal_token_idx
  on public.clientes_comercial (portal_token)
  where portal_token is not null;

alter table public.projetos
  add column if not exists cliente_id uuid references public.clientes_comercial(id) on delete set null,
  add column if not exists portal_visible boolean not null default false,
  add column if not exists portal_phase text not null default 'preparacao',
  add column if not exists portal_progress integer not null default 0,
  add column if not exists portal_update text,
  add column if not exists portal_next_milestone text,
  add column if not exists portal_cover_url text,
  add column if not exists portal_updated_at timestamptz;

create index if not exists projetos_cliente_portal_idx
  on public.projetos (cliente_id, portal_visible);

-- Colunas legadas mantidas somente para migração de instalações antigas. A UI
-- nova não cria nem administra portal a partir de cofres de contratos.
alter table public.client_vaults
  add column if not exists cliente_id uuid references public.clientes_comercial(id) on delete set null,
  add column if not exists portal_enabled boolean not null default false,
  add column if not exists portal_token text,
  add column if not exists portal_welcome_message text,
  add column if not exists portal_last_access_at timestamptz;

create table if not exists public.portal_review_versions (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  entregavel_id uuid,
  thread_id uuid not null default gen_random_uuid(),
  version_number integer not null default 1,
  version_label text not null default 'V1',
  title text not null,
  content_cycle text,
  drive_url text not null,
  drive_file_id text,
  embed_url text,
  message text,
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'changes_requested', 'approved', 'archived')),
  due_at timestamptz,
  published_at timestamptz,
  decided_at timestamptz,
  client_name text,
  client_feedback text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portal_review_versions_project_idx
  on public.portal_review_versions (projeto_id, created_at desc);
create index if not exists portal_review_versions_thread_idx
  on public.portal_review_versions (thread_id, version_number desc);

alter table public.portal_review_versions enable row level security;

drop policy if exists "equipe visualiza revisoes do portal" on public.portal_review_versions;
create policy "equipe visualiza revisoes do portal"
on public.portal_review_versions
for select
to authenticated
using (empresa_id = public.minha_empresa_id());

drop policy if exists "equipe cria revisoes do portal" on public.portal_review_versions;
create policy "equipe cria revisoes do portal"
on public.portal_review_versions
for insert
to authenticated
with check (empresa_id = public.minha_empresa_id());

drop policy if exists "equipe atualiza revisoes do portal" on public.portal_review_versions;
create policy "equipe atualiza revisoes do portal"
on public.portal_review_versions
for update
to authenticated
using (empresa_id = public.minha_empresa_id())
with check (empresa_id = public.minha_empresa_id());

drop policy if exists "equipe remove revisoes do portal" on public.portal_review_versions;
create policy "equipe remove revisoes do portal"
on public.portal_review_versions
for delete
to authenticated
using (empresa_id = public.minha_empresa_id());

create or replace function public.touch_portal_review_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists portal_review_versions_touch on public.portal_review_versions;
create trigger portal_review_versions_touch
before update on public.portal_review_versions
for each row execute function public.touch_portal_review_version();

create or replace function public.configurar_makers_members(
  p_cliente_id uuid,
  p_enabled boolean,
  p_welcome_message text default null,
  p_rotate_token boolean default false
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_empresa_id uuid := public.minha_empresa_id();
  v_token text;
begin
  if v_empresa_id is null then
    raise exception 'Não autenticado';
  end if;

  select portal_token
  into v_token
  from public.clientes_comercial
  where id = p_cliente_id
    and empresa_id = v_empresa_id
  for update;

  if not found then
    raise exception 'Cliente não encontrado';
  end if;

  if v_token is null or p_rotate_token then
    v_token := encode(gen_random_bytes(24), 'hex');
  end if;

  update public.clientes_comercial
  set
    portal_enabled = p_enabled,
    portal_token = v_token,
    portal_welcome_message = nullif(trim(p_welcome_message), '')
  where id = p_cliente_id
    and empresa_id = v_empresa_id;

  return v_token;
end;
$$;

create or replace function public.portal_cliente_publico(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cliente public.clientes_comercial%rowtype;
  v_empresa public.empresas%rowtype;
  v_result jsonb;
begin
  select *
  into v_cliente
  from public.clientes_comercial
  where portal_token = p_token
    and portal_enabled = true;

  if not found then
    return null;
  end if;

  if not exists (
    select 1
    from public.portal_client_users pcu
    where pcu.id = auth.uid()
      and pcu.cliente_id = v_cliente.id
      and pcu.empresa_id = v_cliente.empresa_id
      and pcu.status = 'active'
  ) then
    return null;
  end if;

  select *
  into v_empresa
  from public.empresas
  where id = v_cliente.empresa_id;

  select jsonb_build_object(
    'client', jsonb_build_object(
      'name', v_cliente.nome,
      'responsible_name', (
        select v.responsible_name
        from public.client_vaults v
        where v.cliente_id = v_cliente.id
        order by v.updated_at desc
        limit 1
      ),
      'welcome_message', v_cliente.portal_welcome_message
    ),
    'company', jsonb_build_object(
      'name', v_empresa.nome,
      'logo_url', v_empresa.logo_url,
      'accent_color', coalesce(v_cliente.accent_color, v_empresa.accent_color)
    ),
    'projects', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'name', p.nome,
          'description', p.descricao,
          'phase', coalesce(p.portal_phase, 'preparacao'),
          'progress', coalesce(p.portal_progress, 0),
          'start_date', p.data_inicio,
          'due_date', p.data_entrega,
          'cover_url', p.portal_cover_url,
          'next_milestone', p.portal_next_milestone,
          'milestones', '[]'::jsonb,
          'deliverables', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', rv.id,
                'review_id', rv.id,
                'thread_id', rv.thread_id,
                'kind', coalesce(rv.kind, 'review'),
                'title', rv.title,
                'type', 'video',
                'status', case rv.status
                  when 'pending' then 'revisao'
                  when 'changes_requested' then 'ajustes'
                  when 'approved' then 'aprovado'
                  else 'pendente'
                end,
                'url', rv.drive_url,
                'embed_url', rv.embed_url,
                'drive_file_id', rv.drive_file_id,
                'notes', rv.message,
                'version_label', rv.version_label,
                'version_number', rv.version_number,
                'content_cycle', rv.content_cycle,
                'due_at', rv.due_at,
                'client_feedback', rv.client_feedback,
                'decided_at', rv.decided_at,
                'created_at', rv.created_at
              )
              order by rv.created_at desc
            )
            from public.portal_review_versions rv
            where rv.projeto_id = p.id
              and rv.status not in ('draft', 'archived')
          ), '[]'::jsonb)
        )
        order by p.portal_updated_at desc nulls last, p.criado_em desc
      )
      from public.projetos p
      where p.empresa_id = v_cliente.empresa_id
        and p.cliente_id = v_cliente.id
        and p.portal_visible = true
        and coalesce(p.arquivado, false) = false
    ), '[]'::jsonb),
    'contracts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', ct.id,
          'number', ct.numero,
          'title', ct.title,
          'status', ct.status,
          'pdf_url', coalesce(ct.signed_pdf_url, ct.pdf_url),
          'signature_url', ct.signature_url,
          'signed_at', ct.signed_at,
          'created_at', ct.created_at
        )
        order by ct.created_at desc
      )
      from public.contracts ct
      join public.client_vaults v on v.id = ct.client_vault_id
      where v.cliente_id = v_cliente.id
        and ct.empresa_id = v_cliente.empresa_id
    ), '[]'::jsonb),
    'files', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', f.id,
          'name', f.name,
          'url', f.file_url,
          'type', f.file_type,
          'category', f.category,
          'created_at', f.created_at
        )
        order by f.created_at desc
      )
      from public.client_files f
      join public.client_vaults v on v.id = f.client_vault_id
      where v.cliente_id = v_cliente.id
        and f.empresa_id = v_cliente.empresa_id
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.responder_revisao_portal(
  p_token text,
  p_review_id uuid,
  p_decision text,
  p_feedback text default null,
  p_client_name text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cliente_id uuid;
begin
  if p_decision not in ('approved', 'changes_requested') then
    raise exception 'Decisão inválida';
  end if;

  select c.id
  into v_cliente_id
  from public.clientes_comercial c
  join public.portal_client_users pcu
    on pcu.cliente_id = c.id
   and pcu.empresa_id = c.empresa_id
  where c.portal_token = p_token
    and c.portal_enabled = true
    and pcu.id = auth.uid()
    and pcu.status = 'active';

  if v_cliente_id is null then
    return false;
  end if;

  update public.portal_review_versions rv
  set
    status = p_decision,
    client_feedback = nullif(trim(p_feedback), ''),
    client_name = nullif(trim(p_client_name), ''),
    decided_at = now()
  from public.projetos p
  where rv.id = p_review_id
    and rv.projeto_id = p.id
    and p.cliente_id = v_cliente_id
    and p.portal_visible = true
    and rv.status = 'pending'
    and coalesce(rv.kind, 'review') = 'review';

  return found;
end;
$$;

revoke all on function public.configurar_makers_members(uuid, boolean, text, boolean) from public;
revoke all on function public.portal_cliente_publico(text) from public;
revoke all on function public.responder_revisao_portal(text, uuid, text, text, text) from public;

grant execute on function public.configurar_makers_members(uuid, boolean, text, boolean)
  to authenticated;
grant execute on function public.portal_cliente_publico(text)
  to authenticated;
grant execute on function public.responder_revisao_portal(text, uuid, text, text, text)
  to authenticated;

commit;
