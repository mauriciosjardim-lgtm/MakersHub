-- Makers Members — toda aprovação do cliente vira uma entrega final no mesmo ato.
-- O registro é promovido em vez de duplicado para preservar versão, link e auditoria.

begin;

-- Corrige materiais já aprovados antes desta regra.
update public.portal_review_versions
set kind = 'delivery'
where status = 'approved'
  and coalesce(kind, 'review') = 'review';

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
    kind = case
      when p_decision = 'approved' then 'delivery'
      else rv.kind
    end,
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

revoke all on function public.responder_revisao_portal(text, uuid, text, text, text)
  from public;
grant execute on function public.responder_revisao_portal(text, uuid, text, text, text)
  to authenticated;

commit;
