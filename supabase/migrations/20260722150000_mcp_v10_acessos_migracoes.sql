-- MakersHub MCP v10 — acessos por módulo + migração de projetos
-- Execute depois de mcp_v9.sql.

alter table public.mcp_tokens
  add column if not exists permissoes text[] not null
  default array['comercial','projetos','agenda','financeiro']::text[];

alter table public.mcp_tokens
  drop constraint if exists mcp_tokens_permissoes_validas;
alter table public.mcp_tokens
  add constraint mcp_tokens_permissoes_validas check (
    permissoes <@ array['comercial','projetos','agenda','financeiro']::text[]
  );

create or replace function public.mcp_contexto_acesso(p_token_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_empresa uuid; v_permissoes text[];
begin
  update public.mcp_tokens set ultimo_uso=now()
   where token_hash=p_token_hash and revogado=false
   returning empresa_id,permissoes into v_empresa,v_permissoes;
  if v_empresa is null then
    return jsonb_build_object('ok',false,'erro','Token inválido ou revogado.');
  end if;
  return jsonb_build_object('ok',true,'empresa_id',v_empresa,'permissoes',to_jsonb(v_permissoes));
end $$;

-- Formato normalizado:
-- [{"nome":"Campanha","cliente":"ACME","descricao":"...","valor":1000,
--   "data_inicio":"2026-07-01","data_entrega":"2026-07-30",
--   "fases":["Backlog","Fazendo","Concluída"],"equipe":["Ana"],
--   "tarefas":[{"titulo":"Roteiro","etapa":"Backlog","responsavel":"Ana",
--     "prazo":"2026-07-10T18:00:00-03:00","prioridade":"alta","concluida":false}]}]
create or replace function public.mcp_importar_projetos(
  p_token_hash text,
  p_origem text,
  p_projetos jsonb,
  p_simular boolean default true,
  p_ignorar_duplicados boolean default true
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_empresa uuid; v_permissoes text[]; v_item jsonb; v_tarefa jsonb;
  v_idx int:=0; v_total int:=0; v_validos int:=0; v_inseridos int:=0;
  v_tarefas int:=0; v_duplicados int:=0; v_id uuid; v_nome text; v_cliente text;
  v_fases text[]; v_etapa text; v_prioridade text; v_erros jsonb:='[]'::jsonb;
  v_resultados jsonb:='[]'::jsonb;
begin
  select empresa_id,permissoes into v_empresa,v_permissoes from public.mcp_tokens
   where token_hash=p_token_hash and revogado=false;
  if v_empresa is null then return jsonb_build_object('ok',false,'erro','Token inválido ou revogado.'); end if;
  if not ('projetos'=any(v_permissoes)) then return jsonb_build_object('ok',false,'erro','Acesso sem permissão para Projetos.'); end if;
  if p_origem not in ('trello','monday','excel','xls','xlsx','csv','pdf','outro') then
    return jsonb_build_object('ok',false,'erro','Origem não suportada.');
  end if;
  if jsonb_typeof(p_projetos) <> 'array' then return jsonb_build_object('ok',false,'erro','p_projetos deve ser um array JSON.'); end if;
  v_total:=jsonb_array_length(p_projetos);
  if v_total > 250 then return jsonb_build_object('ok',false,'erro','Máximo de 250 projetos por lote.'); end if;

  for v_item in select value from jsonb_array_elements(p_projetos) loop
    v_idx:=v_idx+1; v_nome:=nullif(trim(v_item->>'nome'),''); v_cliente:=coalesce(nullif(trim(v_item->>'cliente'),''),'—');
    if v_nome is null then
      v_erros:=v_erros||jsonb_build_array(jsonb_build_object('indice',v_idx,'erro','nome é obrigatório'));
      continue;
    end if;
    if v_item ? 'tarefas' and jsonb_typeof(v_item->'tarefas') <> 'array' then
      v_erros:=v_erros||jsonb_build_array(jsonb_build_object('indice',v_idx,'projeto',v_nome,'erro','tarefas deve ser um array'));
      continue;
    end if;
    v_fases:=case when jsonb_typeof(v_item->'fases')='array'
      then array(select jsonb_array_elements_text(v_item->'fases'))
      else array['briefing','pre_producao','captacao','edicao','revisao','entrega','concluida']::text[] end;
    if cardinality(v_fases)=0 then v_fases:=array['briefing','concluida']::text[]; end if;
    v_validos:=v_validos+1;

    if exists(select 1 from public.projetos where empresa_id=v_empresa and lower(nome)=lower(v_nome) and lower(cliente)=lower(v_cliente)) then
      if p_ignorar_duplicados then
        v_duplicados:=v_duplicados+1;
        v_resultados:=v_resultados||jsonb_build_array(jsonb_build_object('indice',v_idx,'projeto',v_nome,'status','ignorado_duplicado'));
        continue;
      end if;
    end if;
    if p_simular then
      v_resultados:=v_resultados||jsonb_build_array(jsonb_build_object('indice',v_idx,'projeto',v_nome,'status','pronto','tarefas',jsonb_array_length(coalesce(v_item->'tarefas','[]'::jsonb))));
      continue;
    end if;

    begin
      insert into public.projetos(empresa_id,nome,cliente,descricao,fase,progresso,fases,equipe,data_inicio,data_entrega,valor,cor,notas)
      values(v_empresa,v_nome,v_cliente,v_item->>'descricao',v_fases[1],0,v_fases,
        case when jsonb_typeof(v_item->'equipe')='array' then array(select jsonb_array_elements_text(v_item->'equipe')) else array[]::text[] end,
        coalesce(nullif(v_item->>'data_inicio','')::date,current_date),nullif(v_item->>'data_entrega','')::date,
        coalesce(nullif(v_item->>'valor','')::numeric,0),coalesce(nullif(v_item->>'cor',''),'primary'),
        concat_ws(E'\n',nullif(v_item->>'notas',''), 'Migrado de '||p_origem||' via MCP')) returning id into v_id;
      for v_tarefa in select value from jsonb_array_elements(coalesce(v_item->'tarefas','[]'::jsonb)) loop
        if nullif(trim(v_tarefa->>'titulo'),'') is null then raise exception 'tarefa sem título'; end if;
        v_etapa:=coalesce(nullif(v_tarefa->>'etapa',''),v_fases[1]);
        if not (v_etapa=any(v_fases)) then v_etapa:=v_fases[1]; end if;
        v_prioridade:=coalesce(nullif(v_tarefa->>'prioridade',''),'media');
        if v_prioridade not in ('baixa','media','alta','urgente') then v_prioridade:='media'; end if;
        insert into public.tarefas(empresa_id,projeto_id,titulo,descricao,status,concluida,responsavel,prazo,prioridade,link)
        values(v_empresa,v_id,trim(v_tarefa->>'titulo'),v_tarefa->>'descricao',v_etapa,
          coalesce((v_tarefa->>'concluida')::boolean,false),coalesce(nullif(v_tarefa->>'responsavel',''),'Agente IA'),
          nullif(v_tarefa->>'prazo','')::timestamptz,v_prioridade,v_tarefa->>'link');
        v_tarefas:=v_tarefas+1;
      end loop;
      perform public._mcp_recalcular_progresso(v_empresa,v_id);
      v_inseridos:=v_inseridos+1;
      v_resultados:=v_resultados||jsonb_build_array(jsonb_build_object('indice',v_idx,'projeto',v_nome,'projeto_id',v_id,'status','importado'));
    exception when others then
      v_erros:=v_erros||jsonb_build_array(jsonb_build_object('indice',v_idx,'projeto',v_nome,'erro',sqlerrm));
    end;
  end loop;
  return jsonb_build_object('ok',true,'simulacao',p_simular,'origem',p_origem,'total_enviados',v_total,
    'validos',v_validos,'projetos_inseridos',v_inseridos,'tarefas_inseridas',v_tarefas,
    'duplicados_ignorados',v_duplicados,'erros',v_erros,'resultados',v_resultados);
end $$;

grant execute on function public.mcp_contexto_acesso(text) to anon,authenticated;
grant execute on function public.mcp_importar_projetos(text,text,jsonb,boolean,boolean) to anon,authenticated;

-- Migração financeira independente. Reaproveita o importador v5 depois da
-- validação/simulação e nunca cria projetos.
create or replace function public.mcp_migrar_financeiro(
  p_token_hash text,
  p_origem text,
  p_lancamentos jsonb,
  p_simular boolean default true,
  p_ignorar_duplicados boolean default true
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_empresa uuid; v_permissoes text[]; v_item jsonb; v_idx int:=0;
  v_total int:=0; v_validos int:=0; v_duplicados int:=0;
  v_candidatos jsonb:='[]'::jsonb; v_erros jsonb:='[]'::jsonb; v_importacao jsonb;
  v_tipo text; v_descricao text; v_valor numeric; v_vencimento date;
begin
  select empresa_id,permissoes into v_empresa,v_permissoes from public.mcp_tokens
   where token_hash=p_token_hash and revogado=false;
  if v_empresa is null then return jsonb_build_object('ok',false,'erro','Token inválido ou revogado.'); end if;
  if not ('financeiro'=any(v_permissoes)) then return jsonb_build_object('ok',false,'erro','Acesso sem permissão para Financeiro.'); end if;
  if p_origem not in ('excel','xls','xlsx','csv','pdf','outro') then return jsonb_build_object('ok',false,'erro','Origem não suportada.'); end if;
  if jsonb_typeof(p_lancamentos)<>'array' then return jsonb_build_object('ok',false,'erro','lancamentos deve ser um array JSON.'); end if;
  v_total:=jsonb_array_length(p_lancamentos);
  if v_total>1000 then return jsonb_build_object('ok',false,'erro','Máximo de 1.000 lançamentos por lote.'); end if;

  for v_item in select value from jsonb_array_elements(p_lancamentos) loop
    v_idx:=v_idx+1;
    begin
      v_tipo:=lower(trim(v_item->>'tipo')); v_descricao:=nullif(trim(v_item->>'descricao'),'');
      if v_tipo not in ('receita','despesa') then raise exception 'tipo deve ser receita ou despesa'; end if;
      if v_descricao is null then raise exception 'descricao é obrigatória'; end if;
      v_valor:=(v_item->>'valor')::numeric;
      if v_valor<0 then raise exception 'valor não pode ser negativo'; end if;
      v_vencimento:=(v_item->>'vencimento')::date;
      if p_ignorar_duplicados and exists(
        select 1 from public.financeiro f where f.empresa_id=v_empresa and f.tipo=v_tipo
          and lower(trim(f.descricao))=lower(v_descricao) and f.valor=v_valor and f.vencimento=v_vencimento
      ) then
        v_duplicados:=v_duplicados+1; continue;
      end if;
      v_validos:=v_validos+1;
      v_candidatos:=v_candidatos||jsonb_build_array(v_item);
    exception when others then
      v_erros:=v_erros||jsonb_build_array(jsonb_build_object('linha',v_idx,'erro',sqlerrm));
    end;
  end loop;

  if p_simular then
    return jsonb_build_object('ok',true,'simulacao',true,'origem',p_origem,'total_enviados',v_total,
      'prontos_para_importar',v_validos,'duplicados_ignorados',v_duplicados,'erros',v_erros);
  end if;
  v_importacao:=public.mcp_importar_lancamentos(p_token_hash,v_candidatos);
  return jsonb_build_object('ok',coalesce((v_importacao->>'ok')::boolean,false),'simulacao',false,'origem',p_origem,
    'total_enviados',v_total,'duplicados_ignorados',v_duplicados,'erros_validacao',v_erros,'importacao',v_importacao);
end $$;

grant execute on function public.mcp_migrar_financeiro(text,text,jsonb,boolean,boolean) to anon,authenticated;
