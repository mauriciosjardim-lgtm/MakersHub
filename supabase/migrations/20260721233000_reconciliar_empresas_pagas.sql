-- Garante que todo pedido concluído mantenha a empresa sem vencimento de trial.
-- A aplicação também faz esta validação depois do provisionamento; o
-- trigger protege contra regressões, webhooks antigos e ajustes manuais.

create or replace function public.reconciliar_empresa_paga()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'completed' then
    update public.empresas e
       set trial_expires_at = null
      from public.usuarios u
     where u.empresa_id = e.id
       and lower(u.email) = lower(new.email);

    if not found then
      raise exception 'Pedido concluído sem empresa vinculada ao e-mail %', new.email;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists pending_orders_reconciliar_empresa_paga
  on public.pending_orders;
create trigger pending_orders_reconciliar_empresa_paga
after insert or update of status
on public.pending_orders
for each row
when (new.status = 'completed')
execute function public.reconciliar_empresa_paga();

-- Repara pedidos que foram concluídos antes deste mecanismo existir.
update public.empresas e
   set trial_expires_at = null
  from public.usuarios u
  join public.pending_orders po
    on lower(po.email) = lower(u.email)
   and po.status = 'completed'
 where u.empresa_id = e.id
   and e.trial_expires_at is not null;
