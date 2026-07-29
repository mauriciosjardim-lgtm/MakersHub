create or replace function public.excluir_lead_comercial(p_lead_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  delete from public.leads
  where id = p_lead_id
    and empresa_id = public.minha_empresa_id();

  if not found then
    raise exception 'Lead nao encontrado';
  end if;

  return true;
end;
$$;

comment on function public.excluir_lead_comercial(uuid) is
  'Exclui um lead ativo ou arquivado da empresa atual. Registros externos já criados permanecem.';
