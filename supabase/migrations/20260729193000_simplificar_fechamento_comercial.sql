create or replace function public.fechar_lead_comercial(
  p_lead_id uuid,
  p_criar_proposta boolean default true,
  p_criar_contrato boolean default true,
  p_criar_projeto boolean default true,
  p_criar_cobranca boolean default true,
  p_promover_cliente boolean default true,
  p_agendar_onboarding boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lead public.leads%rowtype;
  v_cliente public.clientes_comercial%rowtype;
  v_projeto_id uuid;
  v_criados jsonb := '[]'::jsonb;
begin
  if auth.uid() is null
    or public.minha_empresa_id() is null
    or not public.tem_permissao('comercial') then
    raise exception 'Acesso negado ao fechamento comercial';
  end if;

  select * into v_lead
  from public.leads
  where id = p_lead_id
    and empresa_id = public.minha_empresa_id()
    and arquivado_em is null
  for update;

  if not found then raise exception 'Lead ativo nao encontrado'; end if;

  select * into v_cliente
  from public.clientes_comercial
  where id = v_lead.cliente_id;

  if v_lead.etapa <> 'fechado' then
    update public.leads
    set etapa = 'fechado', proxima_acao = null
    where id = v_lead.id;

    insert into public.timeline_lead (
      empresa_id, lead_id, tipo, titulo, descricao, autor
    ) values (
      v_lead.empresa_id, v_lead.id, 'fechado', 'Lead marcado como fechado',
      v_cliente.nome || ' · R$ ' || trim(to_char(v_lead.valor, 'FM999G999G990D00')),
      'Você'
    );
  end if;

  if p_criar_projeto then
    select entidade_id into v_projeto_id
    from public.comercial_lead_links
    where lead_id = v_lead.id
      and tipo = 'projeto'
      and origem = 'fechamento'
    order by criado_em
    limit 1;

    if v_projeto_id is null then
      insert into public.projetos (
        empresa_id, nome, cliente, cliente_id, descricao,
        fase, progresso, equipe, data_inicio, valor, cor
      ) values (
        v_lead.empresa_id, 'Projeto ' || v_cliente.nome, v_cliente.nome,
        v_cliente.id, 'Criado a partir do fechamento comercial',
        'briefing', 0, '{}', current_date, v_lead.valor, 'primary'
      ) returning id into v_projeto_id;

      insert into public.comercial_lead_links (empresa_id, lead_id, tipo, entidade_id)
      values (v_lead.empresa_id, v_lead.id, 'projeto', v_projeto_id)
      on conflict do nothing;
    end if;

    v_criados := v_criados || jsonb_build_array('projeto');
  end if;

  return jsonb_build_object(
    'lead_id', v_lead.id,
    'criados', v_criados,
    'pulados', '[]'::jsonb,
    'projeto_id', v_projeto_id
  );
end;
$$;

comment on function public.fechar_lead_comercial(uuid,boolean,boolean,boolean,boolean,boolean,boolean) is
  'Fecha o lead e, somente quando solicitado, cria um card em Projetos. Os demais parâmetros permanecem por compatibilidade.';

revoke all on function public.fechar_lead_comercial(uuid,boolean,boolean,boolean,boolean,boolean,boolean) from public, anon;
grant execute on function public.fechar_lead_comercial(uuid,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;
