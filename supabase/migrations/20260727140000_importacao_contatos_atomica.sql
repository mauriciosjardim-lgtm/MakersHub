-- Importação de contatos em uma única transação, serializada por tenant.
-- A função deriva o tenant da sessão e nunca aceita empresa_id vindo do cliente.

create or replace function public.normalizar_texto_importacao(valor text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select trim(
    both ' ' from regexp_replace(
      translate(
        lower(coalesce(valor, '')),
        'áàâãäéèêëíìîïóòôõöúùûüçñ',
        'aaaaaeeeeiiiiooooouuuucn'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  )
$$;

create index if not exists clientes_comercial_empresa_nome_importacao_idx
  on public.clientes_comercial (empresa_id, public.normalizar_texto_importacao(nome));
create index if not exists contatos_comercial_empresa_email_importacao_idx
  on public.contatos_comercial (empresa_id, lower(btrim(email)));
create index if not exists contatos_comercial_empresa_telefone_importacao_idx
  on public.contatos_comercial (empresa_id, regexp_replace(telefone, '\D', '', 'g'));
create index if not exists contatos_comercial_empresa_cliente_nome_importacao_idx
  on public.contatos_comercial (
    empresa_id,
    cliente_id,
    public.normalizar_texto_importacao(nome)
  );

create or replace function public.importar_contatos_comercial(
  p_contatos jsonb,
  p_modo text default 'ignorar'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_empresa_id uuid := public.minha_empresa_id();
  v_item jsonb;
  v_nome text;
  v_empresa_nome text;
  v_cargo text;
  v_email text;
  v_telefone text;
  v_telefone_digitos text;
  v_cliente_id uuid;
  v_contato_id uuid;
  v_principal boolean;
  v_importados integer := 0;
  v_atualizados integer := 0;
  v_ignorados integer := 0;
  v_empresas_criadas integer := 0;
begin
  if v_empresa_id is null then
    raise exception 'Usuário sem empresa vinculada' using errcode = '42501';
  end if;
  if p_modo not in ('ignorar', 'atualizar') then
    raise exception 'Modo de importação inválido' using errcode = '22023';
  end if;
  if p_contatos is null or jsonb_typeof(p_contatos) <> 'array' then
    raise exception 'A lista de contatos é inválida' using errcode = '22023';
  end if;
  if jsonb_array_length(p_contatos) > 5000 then
    raise exception 'A importação excede 5000 contatos' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('importar_contatos:' || v_empresa_id::text, 0));

  for v_item in select value from jsonb_array_elements(p_contatos)
  loop
    v_nome := btrim(coalesce(v_item->>'nome', ''));
    v_empresa_nome := btrim(coalesce(v_item->>'empresa', ''));
    v_cargo := nullif(btrim(coalesce(v_item->>'cargo', '')), '');
    v_email := nullif(btrim(coalesce(v_item->>'email', '')), '');
    v_telefone := nullif(btrim(coalesce(v_item->>'telefone', '')), '');
    if v_cargo = '—' then v_cargo := null; end if;
    if v_email = '—' then v_email := null; end if;
    if v_telefone = '—' then v_telefone := null; end if;
    v_telefone_digitos := regexp_replace(coalesce(v_telefone, ''), '\D', '', 'g');

    if v_nome = '' or v_empresa_nome = '' then
      raise exception 'Contato sem nome ou empresa' using errcode = '22023';
    end if;
    if length(v_nome) > 160 or length(v_empresa_nome) > 200 or
       length(coalesce(v_cargo, '')) > 160 or length(coalesce(v_email, '')) > 254 or
       length(coalesce(v_telefone, '')) > 40 then
      raise exception 'Contato com campo acima do limite' using errcode = '22023';
    end if;
    if v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'Contato com e-mail inválido' using errcode = '22023';
    end if;
    if v_telefone is not null and (length(v_telefone_digitos) < 8 or length(v_telefone_digitos) > 15) then
      raise exception 'Contato com telefone inválido' using errcode = '22023';
    end if;

    v_contato_id := null;
    if v_email is not null then
      select id into v_contato_id
      from public.contatos_comercial
      where empresa_id = v_empresa_id
        and lower(btrim(email)) = lower(v_email)
      order by criado_em, id
      limit 1;
    elsif length(v_telefone_digitos) >= 8 then
      select id into v_contato_id
      from public.contatos_comercial
      where empresa_id = v_empresa_id
        and regexp_replace(telefone, '\D', '', 'g') = v_telefone_digitos
      order by criado_em, id
      limit 1;
    end if;

    if v_contato_id is not null then
      if p_modo = 'atualizar' then
        update public.contatos_comercial
        set nome = v_nome,
            cargo = coalesce(v_cargo, cargo),
            email = coalesce(v_email, email),
            telefone = coalesce(v_telefone, telefone)
        where id = v_contato_id and empresa_id = v_empresa_id;
        v_atualizados := v_atualizados + 1;
      else
        v_ignorados := v_ignorados + 1;
      end if;
      continue;
    end if;

    select id into v_cliente_id
    from public.clientes_comercial
    where empresa_id = v_empresa_id
      and public.normalizar_texto_importacao(nome) = public.normalizar_texto_importacao(v_empresa_nome)
    order by criado_em, id
    limit 1;

    if v_cliente_id is null then
      insert into public.clientes_comercial (empresa_id, nome, segmento, cidade)
      values (v_empresa_id, v_empresa_nome, '', '')
      returning id into v_cliente_id;
      v_empresas_criadas := v_empresas_criadas + 1;
    end if;

    if v_email is null and length(v_telefone_digitos) < 8 then
      select id into v_contato_id
      from public.contatos_comercial
      where empresa_id = v_empresa_id
        and cliente_id = v_cliente_id
        and public.normalizar_texto_importacao(nome) = public.normalizar_texto_importacao(v_nome)
      order by criado_em, id
      limit 1;
    end if;

    if v_contato_id is not null then
      if p_modo = 'atualizar' then
        update public.contatos_comercial
        set nome = v_nome,
            cargo = coalesce(v_cargo, cargo),
            email = coalesce(v_email, email),
            telefone = coalesce(v_telefone, telefone)
        where id = v_contato_id and empresa_id = v_empresa_id;
        v_atualizados := v_atualizados + 1;
      else
        v_ignorados := v_ignorados + 1;
      end if;
      continue;
    end if;

    select not exists (
      select 1 from public.contatos_comercial
      where empresa_id = v_empresa_id and cliente_id = v_cliente_id
    ) into v_principal;

    insert into public.contatos_comercial (
      empresa_id, cliente_id, nome, cargo, email, telefone, principal
    ) values (
      v_empresa_id,
      v_cliente_id,
      v_nome,
      coalesce(v_cargo, '—'),
      coalesce(v_email, '—'),
      coalesce(v_telefone, '—'),
      v_principal
    );
    v_importados := v_importados + 1;
  end loop;

  return jsonb_build_object(
    'importados', v_importados,
    'atualizados', v_atualizados,
    'ignorados', v_ignorados,
    'empresasCriadas', v_empresas_criadas
  );
end;
$$;

revoke all on function public.importar_contatos_comercial(jsonb, text) from public;
grant execute on function public.importar_contatos_comercial(jsonb, text) to authenticated;
