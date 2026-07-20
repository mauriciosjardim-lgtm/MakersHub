-- MakersHub — correção incremental do provisionamento de usuários do portal
-- Aplicar depois de portal_security_hardening_migration.sql.

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
  -- O GoTrue pode preencher raw_app_meta_data somente depois do INSERT.
  -- Este sinal apenas impede a criação de uma empresa trial. O vínculo em
  -- portal_client_users continua exclusivo da API com service role.
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
