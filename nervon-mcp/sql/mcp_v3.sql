-- ============================================================================
-- MakersHub MCP v3 — EDITAR e EXCLUIR (mais versatilidade pro conector)
-- ============================================================================
-- Roda este arquivo inteiro no SQL Editor do Supabase (projeto smsqhbbbyjacatxvihks).
-- Mesmo padrão dos anteriores: SECURITY DEFINER, valida o token via _mcp_empresa,
-- resolve a empresa e mexe SÓ no que é dela. Sem service role key.
--
-- Updates usam COALESCE: passe null num campo p/ mantê-lo como está.
-- ============================================================================

-- ─── LEADS ──────────────────────────────────────────────────────────────────

-- Atualiza dados de um lead. Campos null = mantém o valor atual.
-- Se p_email/p_telefone vierem, atualiza também o contato principal do lead.
create or replace function public.mcp_atualizar_lead(
  p_token_hash  text,
  p_lead_id     uuid,
  p_valor       numeric default null,
  p_temperatura text default null,
  p_origem      text default null,
  p_responsavel text default null,
  p_email       text default null,
  p_telefone    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa  uuid;
  v_contato  uuid;
  v_ok       int;
begin
  v_empresa := public._mcp_empresa(p_token_hash);
  if v_empresa is null then
    return jsonb_build_object('ok', false, 'erro', 'Token inválido ou revogado.');
  end if;

  if p_temperatura is not null and p_temperatura not in ('frio','morno','quente') then
    return jsonb_build_object('ok', false, 'erro', 'temperatura deve ser frio, morno ou quente.');
  end if;

  update public.leads
     set valor       = coalesce(p_valor, valor),
         temperatura = coalesce(p_temperatura, temperatura),
         origem      = coalesce(p_origem, origem),
         responsavel = coalesce(p_responsavel, responsavel)
   where id = p_lead_id and empresa_id = v_empresa
  returning contato_id into v_contato;
  get diagnostics v_ok = row_count;

  if v_ok = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Lead não encontrado nesta empresa.');
  end if;

  -- enriquece o contato principal, se pediram
  if (p_email is not null or p_telefone is not null) and v_contato is not null then
    update public.contatos_comercial
       set email    = coalesce(p_email, email),
           telefone = coalesce(p_telefone, telefone)
     where id = v_contato and empresa_id = v_empresa;
  end if;

  insert into public.timeline_lead (empresa_id, lead_id, tipo, titulo, descricao, quando, autor)
  values (v_empresa, p_lead_id, 'observacao', 'Lead atualizado pelo agente IA', 'Dados do lead foram editados.', now(), 'Agente IA');

  return jsonb_build_object('ok', true, 'lead_id', p_lead_id);
end;
$$;

-- Exclui um lead (e seus dependentes diretos: timeline + tarefas).
create or replace function public.mcp_excluir_lead(
  p_token_hash text,
  p_lead_id    uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_ok      int;
begin
  v_empresa := public._mcp_empresa(p_token_hash);
  if v_empresa is null then
    return jsonb_build_object('ok', false, 'erro', 'Token inválido ou revogado.');
  end if;

  -- garante que o lead é desta empresa antes de mexer nos dependentes
  select 1 into v_ok from public.leads where id = p_lead_id and empresa_id = v_empresa;
  if v_ok is null then
    return jsonb_build_object('ok', false, 'erro', 'Lead não encontrado nesta empresa.');
  end if;

  delete from public.timeline_lead where lead_id = p_lead_id and empresa_id = v_empresa;
  delete from public.tarefas_lead  where lead_id = p_lead_id and empresa_id = v_empresa;
  delete from public.leads         where id = p_lead_id and empresa_id = v_empresa;

  return jsonb_build_object('ok', true, 'lead_id', p_lead_id, 'excluido', true);
end;
$$;

-- ─── FOLLOW-UPS ─────────────────────────────────────────────────────────────

-- Lista follow-ups (tarefas de lead). p_apenas_pendentes=true esconde as feitas.
create or replace function public.mcp_listar_followups(
  p_token_hash       text,
  p_apenas_pendentes boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_result  jsonb;
begin
  v_empresa := public._mcp_empresa(p_token_hash);
  if v_empresa is null then
    return jsonb_build_object('ok', false, 'erro', 'Token inválido ou revogado.');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'lead_id', t.lead_id, 'cliente', c.nome,
           'titulo', t.titulo, 'responsavel', t.responsavel,
           'prazo', t.prazo, 'feita', t.feita
         ) order by t.prazo), '[]'::jsonb)
    into v_result
    from public.tarefas_lead t
    join public.leads l on l.id = t.lead_id
    join public.clientes_comercial c on c.id = l.cliente_id
   where t.empresa_id = v_empresa
     and (p_apenas_pendentes is not true or t.feita = false);

  return jsonb_build_object('ok', true, 'followups', v_result);
end;
$$;

-- Marca um follow-up como concluído.
create or replace function public.mcp_concluir_followup(
  p_token_hash text,
  p_followup_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_ok      int;
begin
  v_empresa := public._mcp_empresa(p_token_hash);
  if v_empresa is null then
    return jsonb_build_object('ok', false, 'erro', 'Token inválido ou revogado.');
  end if;

  update public.tarefas_lead
     set feita = true
   where id = p_followup_id and empresa_id = v_empresa;
  get diagnostics v_ok = row_count;

  if v_ok = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Follow-up não encontrado nesta empresa.');
  end if;
  return jsonb_build_object('ok', true, 'followup_id', p_followup_id, 'feita', true);
end;
$$;

-- ─── FINANCEIRO ─────────────────────────────────────────────────────────────

-- Atualiza um lançamento. Campos null = mantém. Recalcula status pelo vencimento.
create or replace function public.mcp_atualizar_lancamento(
  p_token_hash      text,
  p_lancamento_id   uuid,
  p_descricao       text default null,
  p_valor           numeric default null,
  p_categoria       text default null,
  p_vencimento      date default null,
  p_cliente         text default null,
  p_forma_pagamento text default null,
  p_observacoes     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_ok      int;
  v_venc    date;
  v_pgto    date;
  v_tipo    text;
  v_status  text;
begin
  v_empresa := public._mcp_empresa(p_token_hash);
  if v_empresa is null then
    return jsonb_build_object('ok', false, 'erro', 'Token inválido ou revogado.');
  end if;

  update public.financeiro
     set descricao       = coalesce(p_descricao, descricao),
         valor           = coalesce(p_valor, valor),
         categoria       = coalesce(p_categoria, categoria),
         vencimento      = coalesce(p_vencimento, vencimento),
         data            = coalesce(p_vencimento, data),
         cliente         = coalesce(p_cliente, cliente),
         forma_pagamento = coalesce(p_forma_pagamento, forma_pagamento),
         observacoes     = coalesce(p_observacoes, observacoes)
   where id = p_lancamento_id and empresa_id = v_empresa
  returning vencimento, pagamento_em, tipo into v_venc, v_pgto, v_tipo;
  get diagnostics v_ok = row_count;

  if v_ok = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Lançamento não encontrado nesta empresa.');
  end if;

  -- mantém o status coerente com o vencimento (se não está pago)
  v_status := case
    when v_pgto is not null and v_tipo = 'receita' then 'recebido'
    when v_pgto is not null then 'pago'
    when v_venc < current_date then 'atrasado'
    else 'previsto'
  end;
  update public.financeiro set status = v_status where id = p_lancamento_id and empresa_id = v_empresa;

  return jsonb_build_object('ok', true, 'lancamento_id', p_lancamento_id, 'status', v_status);
end;
$$;

-- Exclui um lançamento.
create or replace function public.mcp_excluir_lancamento(
  p_token_hash    text,
  p_lancamento_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_ok      int;
begin
  v_empresa := public._mcp_empresa(p_token_hash);
  if v_empresa is null then
    return jsonb_build_object('ok', false, 'erro', 'Token inválido ou revogado.');
  end if;

  delete from public.financeiro where id = p_lancamento_id and empresa_id = v_empresa;
  get diagnostics v_ok = row_count;

  if v_ok = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Lançamento não encontrado nesta empresa.');
  end if;
  return jsonb_build_object('ok', true, 'lancamento_id', p_lancamento_id, 'excluido', true);
end;
$$;

-- Desfaz o pagamento/recebimento (volta a previsto/atrasado).
create or replace function public.mcp_desfazer_pagamento(
  p_token_hash    text,
  p_lancamento_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_venc    date;
  v_status  text;
begin
  v_empresa := public._mcp_empresa(p_token_hash);
  if v_empresa is null then
    return jsonb_build_object('ok', false, 'erro', 'Token inválido ou revogado.');
  end if;

  update public.financeiro
     set pagamento_em = null,
         status = case when vencimento < current_date then 'atrasado' else 'previsto' end
   where id = p_lancamento_id and empresa_id = v_empresa
  returning status into v_status;

  if v_status is null then
    return jsonb_build_object('ok', false, 'erro', 'Lançamento não encontrado nesta empresa.');
  end if;
  return jsonb_build_object('ok', true, 'lancamento_id', p_lancamento_id, 'status', v_status);
end;
$$;

-- ─── PROJETOS ───────────────────────────────────────────────────────────────

-- Atualiza um projeto. Campos null = mantém.
create or replace function public.mcp_atualizar_projeto(
  p_token_hash   text,
  p_projeto_id   uuid,
  p_nome         text default null,
  p_cliente      text default null,
  p_descricao    text default null,
  p_fase         text default null,
  p_progresso    int default null,
  p_valor        numeric default null,
  p_data_entrega date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_ok      int;
begin
  v_empresa := public._mcp_empresa(p_token_hash);
  if v_empresa is null then
    return jsonb_build_object('ok', false, 'erro', 'Token inválido ou revogado.');
  end if;

  if p_fase is not null and p_fase not in
     ('briefing','pre_producao','captacao','edicao','revisao','entrega','concluida') then
    return jsonb_build_object('ok', false, 'erro', 'fase inválida.');
  end if;
  if p_progresso is not null and (p_progresso < 0 or p_progresso > 100) then
    return jsonb_build_object('ok', false, 'erro', 'progresso deve ser 0 a 100.');
  end if;

  update public.projetos
     set nome         = coalesce(p_nome, nome),
         cliente      = coalesce(p_cliente, cliente),
         descricao    = coalesce(p_descricao, descricao),
         fase         = coalesce(p_fase, fase),
         progresso    = coalesce(p_progresso, progresso),
         valor        = coalesce(p_valor, valor),
         data_entrega = coalesce(p_data_entrega, data_entrega)
   where id = p_projeto_id and empresa_id = v_empresa;
  get diagnostics v_ok = row_count;

  if v_ok = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Projeto não encontrado nesta empresa.');
  end if;
  return jsonb_build_object('ok', true, 'projeto_id', p_projeto_id);
end;
$$;

-- Exclui um projeto.
create or replace function public.mcp_excluir_projeto(
  p_token_hash text,
  p_projeto_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_ok      int;
begin
  v_empresa := public._mcp_empresa(p_token_hash);
  if v_empresa is null then
    return jsonb_build_object('ok', false, 'erro', 'Token inválido ou revogado.');
  end if;

  delete from public.projetos where id = p_projeto_id and empresa_id = v_empresa;
  get diagnostics v_ok = row_count;

  if v_ok = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Projeto não encontrado nesta empresa.');
  end if;
  return jsonb_build_object('ok', true, 'projeto_id', p_projeto_id, 'excluido', true);
end;
$$;

-- ─── AGENDA ─────────────────────────────────────────────────────────────────

-- Atualiza um evento. Campos null = mantém.
create or replace function public.mcp_atualizar_evento(
  p_token_hash text,
  p_evento_id  uuid,
  p_titulo     text default null,
  p_inicio     timestamptz default null,
  p_fim        timestamptz default null,
  p_descricao  text default null,
  p_tipo       text default null,
  p_local      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_ok      int;
begin
  v_empresa := public._mcp_empresa(p_token_hash);
  if v_empresa is null then
    return jsonb_build_object('ok', false, 'erro', 'Token inválido ou revogado.');
  end if;

  if p_tipo is not null and p_tipo not in ('reuniao','gravacao','entrega','tarefa','outro') then
    return jsonb_build_object('ok', false, 'erro', 'tipo inválido.');
  end if;

  update public.eventos
     set titulo    = coalesce(p_titulo, titulo),
         inicio    = coalesce(p_inicio, inicio),
         fim       = coalesce(p_fim, fim),
         descricao = coalesce(p_descricao, descricao),
         tipo      = coalesce(p_tipo, tipo),
         local     = coalesce(p_local, local)
   where id = p_evento_id and empresa_id = v_empresa;
  get diagnostics v_ok = row_count;

  if v_ok = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Evento não encontrado nesta empresa.');
  end if;
  return jsonb_build_object('ok', true, 'evento_id', p_evento_id);
end;
$$;

-- Exclui um evento.
create or replace function public.mcp_excluir_evento(
  p_token_hash text,
  p_evento_id  uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_ok      int;
begin
  v_empresa := public._mcp_empresa(p_token_hash);
  if v_empresa is null then
    return jsonb_build_object('ok', false, 'erro', 'Token inválido ou revogado.');
  end if;

  delete from public.eventos where id = p_evento_id and empresa_id = v_empresa;
  get diagnostics v_ok = row_count;

  if v_ok = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Evento não encontrado nesta empresa.');
  end if;
  return jsonb_build_object('ok', true, 'evento_id', p_evento_id, 'excluido', true);
end;
$$;

-- ─── PERMISSÕES ─────────────────────────────────────────────────────────────
grant execute on function public.mcp_atualizar_lead(text,uuid,numeric,text,text,text,text,text) to anon, authenticated;
grant execute on function public.mcp_excluir_lead(text,uuid) to anon, authenticated;
grant execute on function public.mcp_listar_followups(text,boolean) to anon, authenticated;
grant execute on function public.mcp_concluir_followup(text,uuid) to anon, authenticated;
grant execute on function public.mcp_atualizar_lancamento(text,uuid,text,numeric,text,date,text,text,text) to anon, authenticated;
grant execute on function public.mcp_excluir_lancamento(text,uuid) to anon, authenticated;
grant execute on function public.mcp_desfazer_pagamento(text,uuid) to anon, authenticated;
grant execute on function public.mcp_atualizar_projeto(text,uuid,text,text,text,text,int,numeric,date) to anon, authenticated;
grant execute on function public.mcp_excluir_projeto(text,uuid) to anon, authenticated;
grant execute on function public.mcp_atualizar_evento(text,uuid,text,timestamptz,timestamptz,text,text,text) to anon, authenticated;
grant execute on function public.mcp_excluir_evento(text,uuid) to anon, authenticated;
