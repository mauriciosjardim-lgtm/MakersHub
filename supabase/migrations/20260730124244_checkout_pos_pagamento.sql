-- Separa a compra da criação de senha. O navegador recebe o segredo bruto;
-- somente o hash e seu ciclo de vida ficam persistidos.

alter table public.pending_orders
  add column if not exists activation_secret_hash text,
  add column if not exists activation_expires_at timestamptz,
  add column if not exists activation_consumed_at timestamptz,
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists pending_orders_activation_secret_hash_key
  on public.pending_orders (activation_secret_hash)
  where activation_secret_hash is not null;

-- Um e-mail já cadastrado é reconciliado no banco sem depender de listagem da
-- Admin API. Se ele já pertence a uma empresa, preserva o nome da empresa e
-- apenas libera o acesso pago; caso contrário cria o vínculo normalmente.
create or replace function public.criar_conta_paga(
  p_auth_user_id uuid,
  p_nome text,
  p_email text,
  p_empresa_nome text,
  p_payment_id text
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_auth_user_id uuid := p_auth_user_id;
  v_empresa_id uuid;
begin
  if exists (
    select 1
      from public.pending_orders
     where asaas_payment_id = p_payment_id
       and status = 'completed'
  ) then
    return;
  end if;

  if v_auth_user_id is null then
    select id
      into v_auth_user_id
      from auth.users
     where lower(email) = lower(btrim(p_email))
     limit 1;
  end if;

  if v_auth_user_id is null then
    raise exception 'Usuário pago não encontrado para provisionamento';
  end if;

  select empresa_id
    into v_empresa_id
    from public.usuarios
   where id = v_auth_user_id;

  if v_empresa_id is not null then
    update public.empresas
       set trial_expires_at = null
     where id = v_empresa_id;
  else
    insert into public.empresas (nome, trial_expires_at)
    values (p_empresa_nome, null)
    returning id into v_empresa_id;

    insert into public.usuarios (id, empresa_id, nome, email)
    values (v_auth_user_id, v_empresa_id, p_nome, lower(btrim(p_email)));
  end if;

  update public.pending_orders
     set status = 'completed',
         completed_at = now(),
         auth_user_id = v_auth_user_id,
         senha = null
   where asaas_payment_id = p_payment_id;
end;
$$;

revoke all on function public.criar_conta_paga(uuid, text, text, text, text) from public;
revoke all on function public.criar_conta_paga(uuid, text, text, text, text) from anon;
revoke all on function public.criar_conta_paga(uuid, text, text, text, text) from authenticated;
grant execute on function public.criar_conta_paga(uuid, text, text, text, text) to service_role;
