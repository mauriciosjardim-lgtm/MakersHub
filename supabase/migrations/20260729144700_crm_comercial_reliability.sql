-- CRM Comercial: arquivamento recuperavel, fechamento transacional e
-- criacao de lead sem duplicar empresa/contato.

alter table public.leads
  add column if not exists arquivado boolean not null default false,
  add column if not exists arquivado_em timestamptz,
  add column if not exists arquivado_por uuid references auth.users(id) on delete set null,
  add column if not exists motivo_arquivamento text,
  add column if not exists etapa_antes_arquivar text;

alter table public.clientes_comercial
  add column if not exists arquivado boolean not null default false,
  add column if not exists cliente_ativo boolean not null default false,
  add column if not exists status text not null default 'prospect';

alter table public.clientes_comercial
  drop constraint if exists clientes_comercial_status_check;
alter table public.clientes_comercial
  add constraint clientes_comercial_status_check
  check (status in ('prospect', 'cliente', 'inativo'));

update public.leads
set arquivado_em = now(),
    etapa_antes_arquivar = etapa
where arquivado and arquivado_em is null;

update public.clientes_comercial c
set status = case
  when c.arquivado then 'inativo'
  when c.cliente_ativo or exists (
    select 1 from public.projetos p where p.cliente_id = c.id
  ) then 'cliente'
  else 'prospect'
end;

alter table public.timeline_lead
  drop constraint if exists timeline_lead_tipo_check;
alter table public.timeline_lead
  add constraint timeline_lead_tipo_check
  check (tipo in (
    'criado', 'ligacao', 'reuniao', 'whatsapp', 'email',
    'proposta_enviada', 'observacao', 'etapa_mudou', 'fechado',
    'perdido', 'arquivado', 'restaurado'
  ));

create table if not exists public.comercial_lead_links (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  tipo text not null check (tipo in ('proposta', 'contrato', 'projeto', 'financeiro', 'onboarding')),
  entidade_id uuid not null,
  origem text not null default 'fechamento' check (origem in ('fechamento', 'manual')),
  criado_em timestamptz not null default now(),
  unique (lead_id, tipo, entidade_id)
);

create index if not exists comercial_lead_links_empresa_idx
  on public.comercial_lead_links (empresa_id, lead_id);

create unique index if not exists comercial_lead_links_fechamento_unico_idx
  on public.comercial_lead_links (lead_id, tipo)
  where origem = 'fechamento';

alter table public.comercial_lead_links enable row level security;

drop policy if exists comercial_lead_links_select on public.comercial_lead_links;
create policy comercial_lead_links_select on public.comercial_lead_links
  for select to authenticated
  using (
    empresa_id = public.minha_empresa_id()
    and public.tem_permissao('comercial')
  );

drop policy if exists comercial_lead_links_insert on public.comercial_lead_links;
create policy comercial_lead_links_insert on public.comercial_lead_links
  for insert to authenticated
  with check (
    empresa_id = public.minha_empresa_id()
    and public.tem_permissao('comercial')
  );

drop policy if exists comercial_lead_links_delete on public.comercial_lead_links;
create policy comercial_lead_links_delete on public.comercial_lead_links
  for delete to authenticated
  using (
    empresa_id = public.minha_empresa_id()
    and public.tem_permissao('comercial')
  );

grant select, insert, delete on public.comercial_lead_links to authenticated;

create or replace function public.criar_lead_comercial(
  p_empresa_nome text,
  p_contato_nome text,
  p_contato_email text default null,
  p_contato_telefone text default null,
  p_valor numeric default 0,
  p_responsavel text default 'Você',
  p_temperatura text default 'morno',
  p_origem text default 'Indicação',
  p_cidade text default null,
  p_segmento text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_empresa_id uuid := public.minha_empresa_id();
  v_cliente_id uuid;
  v_contato_id uuid;
  v_lead_id uuid;
  v_email text := nullif(lower(btrim(coalesce(p_contato_email, ''))), '');
  v_telefone text := nullif(regexp_replace(coalesce(p_contato_telefone, ''), '\D', '', 'g'), '');
begin
  if v_empresa_id is null then
    raise exception 'Usuario sem empresa vinculada';
  end if;
  if nullif(btrim(p_empresa_nome), '') is null or nullif(btrim(p_contato_nome), '') is null then
    raise exception 'Empresa e contato sao obrigatorios';
  end if;
  if p_temperatura not in ('frio', 'morno', 'quente') then
    raise exception 'Temperatura invalida';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_empresa_id::text || ':' || lower(btrim(p_empresa_nome)), 0)
  );

  select id into v_cliente_id
  from public.clientes_comercial
  where empresa_id = v_empresa_id
    and lower(btrim(nome)) = lower(btrim(p_empresa_nome))
  order by criado_em, id
  limit 1;

  if v_cliente_id is null then
    insert into public.clientes_comercial (
      empresa_id, nome, segmento, cidade, status
    ) values (
      v_empresa_id,
      btrim(p_empresa_nome),
      coalesce(nullif(btrim(p_segmento), ''), 'Não informado'),
      coalesce(nullif(btrim(p_cidade), ''), 'Não informado'),
      'prospect'
    ) returning id into v_cliente_id;
  else
    update public.clientes_comercial
    set segmento = case
          when segmento in ('', 'Não informado') then coalesce(nullif(btrim(p_segmento), ''), segmento)
          else segmento
        end,
        cidade = case
          when cidade in ('', 'Não informado') then coalesce(nullif(btrim(p_cidade), ''), cidade)
          else cidade
        end
    where id = v_cliente_id;
  end if;

  select id into v_contato_id
  from public.contatos_comercial
  where empresa_id = v_empresa_id
    and cliente_id = v_cliente_id
    and (
      (v_email is not null and lower(nullif(email, '—')) = v_email)
      or (v_telefone is not null and regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = v_telefone)
      or (
        v_email is null and v_telefone is null
        and lower(btrim(nome)) = lower(btrim(p_contato_nome))
      )
    )
  order by principal desc, criado_em, id
  limit 1;

  if v_contato_id is null then
    insert into public.contatos_comercial (
      empresa_id, cliente_id, nome, cargo, email, telefone, principal
    ) values (
      v_empresa_id,
      v_cliente_id,
      btrim(p_contato_nome),
      '—',
      coalesce(v_email, '—'),
      coalesce(nullif(btrim(p_contato_telefone), ''), '—'),
      not exists (
        select 1 from public.contatos_comercial where cliente_id = v_cliente_id
      )
    ) returning id into v_contato_id;
  end if;

  insert into public.leads (
    empresa_id, cliente_id, contato_id, etapa, valor,
    responsavel, temperatura, origem
  ) values (
    v_empresa_id,
    v_cliente_id,
    v_contato_id,
    'novo',
    greatest(coalesce(p_valor, 0), 0),
    coalesce(nullif(btrim(p_responsavel), ''), 'Você'),
    p_temperatura,
    coalesce(nullif(btrim(p_origem), ''), 'Não informado')
  ) returning id into v_lead_id;

  insert into public.timeline_lead (
    empresa_id, lead_id, tipo, titulo, descricao, autor
  ) values (
    v_empresa_id,
    v_lead_id,
    'criado',
    'Lead criado',
    btrim(p_empresa_nome),
    coalesce(nullif(btrim(p_responsavel), ''), 'Você')
  );

  return jsonb_build_object(
    'lead_id', v_lead_id,
    'cliente_id', v_cliente_id,
    'contato_id', v_contato_id
  );
end;
$$;

create or replace function public.arquivar_lead_comercial(
  p_lead_id uuid,
  p_motivo text default null
)
returns public.leads
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_lead public.leads%rowtype;
begin
  select * into v_lead
  from public.leads
  where id = p_lead_id and empresa_id = public.minha_empresa_id()
  for update;

  if not found then raise exception 'Lead nao encontrado'; end if;
  if v_lead.arquivado_em is not null then return v_lead; end if;

  update public.leads
  set arquivado = true,
      arquivado_em = now(),
      arquivado_por = auth.uid(),
      motivo_arquivamento = nullif(btrim(p_motivo), ''),
      etapa_antes_arquivar = etapa
  where id = p_lead_id
  returning * into v_lead;

  insert into public.timeline_lead (
    empresa_id, lead_id, tipo, titulo, descricao, autor
  ) values (
    v_lead.empresa_id, v_lead.id, 'arquivado', 'Lead arquivado',
    v_lead.motivo_arquivamento, 'Você'
  );

  return v_lead;
end;
$$;

create or replace function public.restaurar_lead_comercial(p_lead_id uuid)
returns public.leads
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_lead public.leads%rowtype;
begin
  select * into v_lead
  from public.leads
  where id = p_lead_id and empresa_id = public.minha_empresa_id()
  for update;

  if not found then raise exception 'Lead nao encontrado'; end if;
  if v_lead.arquivado_em is null then return v_lead; end if;

  update public.leads
  set etapa = case
        when etapa_antes_arquivar in ('novo','diagnostico','reuniao','proposta','negociacao','fechado','perdido')
          then etapa_antes_arquivar
        else etapa
      end,
      arquivado = false,
      arquivado_em = null,
      arquivado_por = null,
      motivo_arquivamento = null,
      etapa_antes_arquivar = null
  where id = p_lead_id
  returning * into v_lead;

  insert into public.timeline_lead (
    empresa_id, lead_id, tipo, titulo, autor
  ) values (
    v_lead.empresa_id, v_lead.id, 'restaurado', 'Lead restaurado', 'Você'
  );

  return v_lead;
end;
$$;

create or replace function public.excluir_lead_comercial(p_lead_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_arquivado_em timestamptz;
begin
  select arquivado_em into v_arquivado_em
  from public.leads
  where id = p_lead_id and empresa_id = public.minha_empresa_id()
  for update;

  if not found then raise exception 'Lead nao encontrado'; end if;
  if v_arquivado_em is null then
    raise exception 'Arquive o lead antes de exclui-lo definitivamente';
  end if;

  delete from public.leads where id = p_lead_id;
  return true;
end;
$$;

create or replace function public.mover_lead_comercial(
  p_lead_id uuid,
  p_etapa text
)
returns public.leads
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_lead public.leads%rowtype;
  v_etapa_anterior text;
  v_titulos jsonb := jsonb_build_object(
    'novo', 'Novo lead',
    'diagnostico', 'Diagnóstico',
    'reuniao', 'Reunião',
    'proposta', 'Proposta',
    'negociacao', 'Negociação',
    'fechado', 'Fechado',
    'perdido', 'Perdido'
  );
begin
  if p_etapa not in ('novo','diagnostico','reuniao','proposta','negociacao','perdido') then
    raise exception 'Etapa invalida para movimentacao direta';
  end if;

  select * into v_lead
  from public.leads
  where id = p_lead_id
    and empresa_id = public.minha_empresa_id()
    and arquivado_em is null
  for update;

  if not found then raise exception 'Lead ativo nao encontrado'; end if;
  if v_lead.etapa = p_etapa then return v_lead; end if;
  v_etapa_anterior := v_lead.etapa;

  update public.leads
  set etapa = p_etapa,
      proxima_acao = case when p_etapa = 'perdido' then null else proxima_acao end
  where id = p_lead_id
  returning * into v_lead;

  insert into public.timeline_lead (
    empresa_id, lead_id, tipo, titulo, autor
  ) values (
    v_lead.empresa_id,
    v_lead.id,
    case when p_etapa = 'perdido' then 'perdido' else 'etapa_mudou' end,
    case
      when p_etapa = 'perdido' then 'Marcado como perdido'
      else 'Movido de ' || (v_titulos ->> v_etapa_anterior) || ' → ' || (v_titulos ->> p_etapa)
    end,
    'Você'
  );

  return v_lead;
end;
$$;

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
  v_contato public.contatos_comercial%rowtype;
  v_proposta_id uuid;
  v_contrato_id uuid;
  v_projeto_id uuid;
  v_financeiro_id uuid;
  v_onboarding_id uuid;
  v_vault_id uuid;
  v_numero bigint;
  v_ano integer := extract(year from current_date)::integer;
  v_criados jsonb := '[]'::jsonb;
  v_pulados jsonb := '[]'::jsonb;
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

  select * into v_cliente from public.clientes_comercial where id = v_lead.cliente_id;
  select * into v_contato from public.contatos_comercial where id = v_lead.contato_id;

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

  if p_promover_cliente then
    update public.clientes_comercial
    set status = 'cliente', cliente_ativo = true, arquivado = false
    where id = v_cliente.id;
    v_criados := v_criados || jsonb_build_array('cliente');
  end if;

  if p_criar_proposta then
    select entidade_id into v_proposta_id
    from public.comercial_lead_links
    where lead_id = v_lead.id and tipo = 'proposta' and origem = 'fechamento';

    if v_proposta_id is null then
      select id into v_proposta_id
      from public.propostas
      where lead_id = v_lead.id
      order by criado_em limit 1;
    end if;

    if v_proposta_id is null then
      perform pg_advisory_xact_lock(
        hashtextextended(v_lead.empresa_id::text || ':' || v_ano::text, 0)
      );
      select coalesce(max(numero), 0) + 1 into v_numero
      from public.propostas
      where empresa_id = v_lead.empresa_id and ano = v_ano;

      insert into public.propostas (
        empresa_id, lead_id, numero, ano, status, cliente_nome,
        cliente_empresa, titulo_projeto, rascunho
      ) values (
        v_lead.empresa_id, v_lead.id, v_numero, v_ano, 'rascunho',
        v_contato.nome, v_cliente.nome, 'Projeto ' || v_cliente.nome,
        jsonb_build_object('tipo_preco', 'fechado', 'valor', v_lead.valor)
      ) returning id into v_proposta_id;
    end if;

    insert into public.comercial_lead_links (empresa_id, lead_id, tipo, entidade_id)
    values (v_lead.empresa_id, v_lead.id, 'proposta', v_proposta_id)
    on conflict do nothing;
    v_criados := v_criados || jsonb_build_array('proposta');
  end if;

  if p_criar_projeto then
    select entidade_id into v_projeto_id
    from public.comercial_lead_links
    where lead_id = v_lead.id and tipo = 'projeto' and origem = 'fechamento';

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
      values (v_lead.empresa_id, v_lead.id, 'projeto', v_projeto_id);
    end if;
    v_criados := v_criados || jsonb_build_array('projeto');
  end if;

  if p_criar_contrato then
    select entidade_id into v_contrato_id
    from public.comercial_lead_links
    where lead_id = v_lead.id and tipo = 'contrato' and origem = 'fechamento';

    if v_contrato_id is null then
      select id into v_vault_id
      from public.client_vaults
      where empresa_id = v_lead.empresa_id
        and lower(btrim(name)) = lower(btrim(v_cliente.nome))
      order by created_at limit 1;

      if v_vault_id is null then
        insert into public.client_vaults (
          empresa_id, name, fantasy_name, email, phone, city, responsible_name
        ) values (
          v_lead.empresa_id, v_cliente.nome, v_cliente.nome,
          nullif(v_contato.email, '—'), nullif(v_contato.telefone, '—'),
          nullif(v_cliente.cidade, 'Não informado'), v_contato.nome
        ) returning id into v_vault_id;
      end if;

      insert into public.contracts (
        empresa_id, client_vault_id, title, status, form_data
      ) values (
        v_lead.empresa_id, v_vault_id, 'Contrato · ' || v_cliente.nome,
        'rascunho', jsonb_build_object(
          'CLIENTE_NOME', v_contato.nome,
          'VALOR_TOTAL', v_lead.valor,
          'SERVICO_NOME', 'Produção audiovisual'
        )
      ) returning id into v_contrato_id;

      insert into public.comercial_lead_links (empresa_id, lead_id, tipo, entidade_id)
      values (v_lead.empresa_id, v_lead.id, 'contrato', v_contrato_id);
    end if;
    v_criados := v_criados || jsonb_build_array('contrato');
  end if;

  if p_criar_cobranca then
    if v_lead.valor <= 0 then
      v_pulados := v_pulados || jsonb_build_array('cobranca_sem_valor');
    else
      select entidade_id into v_financeiro_id
      from public.comercial_lead_links
      where lead_id = v_lead.id and tipo = 'financeiro' and origem = 'fechamento';

      if v_financeiro_id is null then
        insert into public.financeiro (
          empresa_id, projeto_id, tipo, categoria, descricao, valor,
          data, vencimento, cliente, status, observacoes
        ) values (
          v_lead.empresa_id, v_projeto_id, 'receita', 'Projeto',
          'Projeto · ' || v_cliente.nome, v_lead.valor,
          current_date, current_date, v_cliente.nome, 'previsto',
          'Gerado pelo fechamento do lead'
        ) returning id into v_financeiro_id;

        insert into public.comercial_lead_links (empresa_id, lead_id, tipo, entidade_id)
        values (v_lead.empresa_id, v_lead.id, 'financeiro', v_financeiro_id);
      end if;
      v_criados := v_criados || jsonb_build_array('cobranca');
    end if;
  end if;

  if p_agendar_onboarding then
    select entidade_id into v_onboarding_id
    from public.comercial_lead_links
    where lead_id = v_lead.id and tipo = 'onboarding' and origem = 'fechamento';

    if v_onboarding_id is null then
      insert into public.eventos (
        empresa_id, titulo, descricao, inicio, fim, tipo, participantes
      ) values (
        v_lead.empresa_id, 'Onboarding · ' || v_cliente.nome,
        'Reunião inicial criada pelo fechamento comercial',
        date_trunc('day', now() + interval '7 days') + interval '10 hours',
        date_trunc('day', now() + interval '7 days') + interval '11 hours',
        'reuniao', array[v_contato.nome]
      ) returning id into v_onboarding_id;

      insert into public.comercial_lead_links (empresa_id, lead_id, tipo, entidade_id)
      values (v_lead.empresa_id, v_lead.id, 'onboarding', v_onboarding_id);
    end if;
    v_criados := v_criados || jsonb_build_array('onboarding');
  end if;

  return jsonb_build_object(
    'lead_id', v_lead.id,
    'criados', v_criados,
    'pulados', v_pulados,
    'proposta_id', v_proposta_id,
    'contrato_id', v_contrato_id,
    'projeto_id', v_projeto_id,
    'financeiro_id', v_financeiro_id,
    'onboarding_id', v_onboarding_id
  );
end;
$$;

revoke all on function public.criar_lead_comercial(text,text,text,text,numeric,text,text,text,text,text) from public, anon;
revoke all on function public.arquivar_lead_comercial(uuid,text) from public, anon;
revoke all on function public.restaurar_lead_comercial(uuid) from public, anon;
revoke all on function public.excluir_lead_comercial(uuid) from public, anon;
revoke all on function public.mover_lead_comercial(uuid,text) from public, anon;
revoke all on function public.fechar_lead_comercial(uuid,boolean,boolean,boolean,boolean,boolean,boolean) from public, anon;

grant execute on function public.criar_lead_comercial(text,text,text,text,numeric,text,text,text,text,text) to authenticated;
grant execute on function public.arquivar_lead_comercial(uuid,text) to authenticated;
grant execute on function public.restaurar_lead_comercial(uuid) to authenticated;
grant execute on function public.excluir_lead_comercial(uuid) to authenticated;
grant execute on function public.mover_lead_comercial(uuid,text) to authenticated;
grant execute on function public.fechar_lead_comercial(uuid,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;
