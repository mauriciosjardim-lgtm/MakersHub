-- Google Workspace Limited Use boundary: events that have ever been linked to
-- Google Calendar must never be returned to or mutated through the MCP surface
-- used by third-party AI clients.

create index if not exists google_calendar_links_empresa_local_event
  on public.google_calendar_event_links (empresa_id, local_event_id);

create or replace function public.mcp_listar_eventos(
  p_token_hash text,
  p_de timestamptz default null,
  p_ate timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_result jsonb;
begin
  v_empresa := public._mcp_empresa(p_token_hash);
  if v_empresa is null then
    return jsonb_build_object('ok', false, 'erro', 'Token inválido ou revogado.');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'titulo', e.titulo, 'inicio', e.inicio, 'fim', e.fim,
           'tipo', e.tipo, 'local', e.local
         ) order by e.inicio), '[]'::jsonb)
    into v_result
  from public.eventos e
  where e.empresa_id = v_empresa
    and (p_de is null or e.inicio >= p_de)
    and (p_ate is null or e.inicio <= p_ate)
    and not exists (
      select 1
      from public.google_calendar_event_links g
      where g.empresa_id = v_empresa
        and g.local_event_id = e.id
    );

  return jsonb_build_object('ok', true, 'eventos', v_result);
end;
$$;

create or replace function public.mcp_atualizar_evento(
  p_token_hash text,
  p_evento_id uuid,
  p_titulo text default null,
  p_inicio timestamptz default null,
  p_fim timestamptz default null,
  p_descricao text default null,
  p_tipo text default null,
  p_local text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_ok int;
begin
  v_empresa := public._mcp_empresa(p_token_hash);
  if v_empresa is null then
    return jsonb_build_object('ok', false, 'erro', 'Token inválido ou revogado.');
  end if;

  if p_tipo is not null and p_tipo not in ('reuniao','gravacao','entrega','tarefa','outro') then
    return jsonb_build_object('ok', false, 'erro', 'tipo inválido.');
  end if;

  update public.eventos e
     set titulo = coalesce(p_titulo, e.titulo),
         inicio = coalesce(p_inicio, e.inicio),
         fim = coalesce(p_fim, e.fim),
         descricao = coalesce(p_descricao, e.descricao),
         tipo = coalesce(p_tipo, e.tipo),
         local = coalesce(p_local, e.local)
   where e.id = p_evento_id
     and e.empresa_id = v_empresa
     and not exists (
       select 1
       from public.google_calendar_event_links g
       where g.empresa_id = v_empresa
         and g.local_event_id = e.id
     );
  get diagnostics v_ok = row_count;

  if v_ok = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Evento não encontrado nesta empresa.');
  end if;
  return jsonb_build_object('ok', true, 'evento_id', p_evento_id);
end;
$$;

create or replace function public.mcp_excluir_evento(
  p_token_hash text,
  p_evento_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_ok int;
begin
  v_empresa := public._mcp_empresa(p_token_hash);
  if v_empresa is null then
    return jsonb_build_object('ok', false, 'erro', 'Token inválido ou revogado.');
  end if;

  delete from public.eventos e
   where e.id = p_evento_id
     and e.empresa_id = v_empresa
     and not exists (
       select 1
       from public.google_calendar_event_links g
       where g.empresa_id = v_empresa
         and g.local_event_id = e.id
     );
  get diagnostics v_ok = row_count;

  if v_ok = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Evento não encontrado nesta empresa.');
  end if;
  return jsonb_build_object('ok', true, 'evento_id', p_evento_id, 'excluido', true);
end;
$$;

comment on function public.mcp_listar_eventos(text,timestamptz,timestamptz) is
  'MCP event listing with Google Calendar linked events excluded for Workspace Limited Use compliance.';
comment on function public.mcp_atualizar_evento(text,uuid,text,timestamptz,timestamptz,text,text,text) is
  'MCP event update with Google Calendar linked events blocked for Workspace Limited Use compliance.';
comment on function public.mcp_excluir_evento(text,uuid) is
  'MCP event deletion with Google Calendar linked events blocked for Workspace Limited Use compliance.';
