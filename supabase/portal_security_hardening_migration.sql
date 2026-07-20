-- Makers Members — consolidação do token e hardening da autenticação.
-- Execute depois de:
--   1. portal_cliente_migration.sql
--   2. portal_client_auth_migration.sql
--   3. portal_deliveries_migration.sql

begin;

-- A arquitetura atual tem clientes_comercial como fonte única do portal.
-- Migra tokens legados de cofres somente quando o cliente ainda não possui um.
with legacy as (
  select distinct on (v.cliente_id)
    v.cliente_id,
    v.portal_token,
    v.portal_welcome_message
  from public.client_vaults v
  where v.cliente_id is not null
    and v.portal_enabled = true
    and v.portal_token is not null
  order by v.cliente_id, v.updated_at desc
)
update public.clientes_comercial c
set
  portal_token = legacy.portal_token,
  portal_enabled = true,
  portal_welcome_message = coalesce(c.portal_welcome_message, legacy.portal_welcome_message)
from legacy
where c.id = legacy.cliente_id
  and c.portal_token is null;

-- Preserva o único legado sem competência usando o mês de publicação e passa
-- a garantir a organização também no banco, não apenas no formulário.
update public.portal_review_versions
set content_cycle = to_char(coalesce(published_at, created_at), 'YYYY-MM')
where content_cycle is null or btrim(content_cycle) = '';

alter table public.portal_review_versions
  alter column content_cycle set not null;

alter table public.portal_review_versions
  drop constraint if exists portal_review_versions_content_cycle_check;
alter table public.portal_review_versions
  add constraint portal_review_versions_content_cycle_check
  check (btrim(content_cycle) <> '');

-- Usuários já existentes passam a carregar a classificação protegida em
-- app_metadata. Diferente de user_metadata, esse campo não é controlável pelo
-- signup público.
update auth.users au
set raw_app_meta_data =
  coalesce(au.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('account_type', 'client_portal')
where exists (
  select 1
  from public.portal_client_users pcu
  where pcu.id = au.id
);

-- Impede que o mesmo UUID do Auth ou o mesmo e-mail pertença às duas áreas.
-- A auditoria anterior à migration deve estar sem colisões; depois dela, o
-- próprio banco preserva essa separação em inserts e alterações futuras.
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

-- O trigger deixa de criar portal_client_users a partir de user_metadata.
-- Contas de portal são vinculadas exclusivamente pela API autenticada com
-- service role, depois de validar o administrador, a empresa e o cliente.
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

  select *
  into v_convite
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
      coalesce(
        new.raw_user_meta_data->>'nome',
        v_convite.nome,
        split_part(new.email, '@', 1)
      ),
      new.email,
      v_convite.role,
      v_convite.permissoes
    );
    update public.equipe_convites
    set status = 'aceito'
    where id = v_convite.id;
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

-- Compensação defensiva para instalações que ainda executem uma versão antiga
-- do trigger. Só remove a empresa trial recém-criada quando o único usuário
-- vinculado é exatamente a conta de portal que falhou durante o provisionamento.
create or replace function public.cleanup_failed_portal_provisioning(
  p_auth_user_id uuid,
  p_empresa_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_deleted_count integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Operação restrita ao serviço';
  end if;

  delete from public.empresas e
  where e.id = p_empresa_id
    and e.criado_em >= now() - interval '15 minutes'
    and e.trial_expires_at is not null
    and exists (
      select 1
      from public.usuarios u
      where u.id = p_auth_user_id
        and u.empresa_id = e.id
    )
    and not exists (
      select 1
      from public.usuarios u
      where u.empresa_id = e.id
        and u.id <> p_auth_user_id
    );

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count > 0;
end;
$function$;

revoke all on function public.cleanup_failed_portal_provisioning(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cleanup_failed_portal_provisioning(uuid, uuid)
  to service_role;

-- clientes_comercial é a fonte canônica do token. A função também garante que
-- o usuário pertence ao cliente e que ambos os acessos estão ativos.
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
  select c.portal_token, c.id
  into v_token, v_cliente_id
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

-- A RPC antiga mapeava status, mas não devolvia kind. Isso fazia uma revisão
-- aprovada ser confundida com entrega final. A versão abaixo mantém as duas
-- dimensões separadas no payload público.
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
                'kind', rv.kind,
                'title', rv.title,
                'type', 'video',
                'status', case rv.status
                  when 'pending' then 'revisao'
                  when 'changes_requested' then 'ajustes'
                  when 'approved' then 'aprovado'
                  when 'archived' then 'entregue'
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
              and rv.status <> 'draft'
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
    and rv.kind = 'review';

  return found;
end;
$$;

revoke all on function public.meu_portal_token() from public;
grant execute on function public.meu_portal_token() to authenticated;
revoke all on function public.portal_cliente_publico(text) from public;
revoke all on function public.responder_revisao_portal(text, uuid, text, text, text) from public;
grant execute on function public.portal_cliente_publico(text) to authenticated;
grant execute on function public.responder_revisao_portal(text, uuid, text, text, text)
  to authenticated;

commit;
