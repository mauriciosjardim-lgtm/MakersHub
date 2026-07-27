-- Personalização segura da Jornada Comercial e arquivamento reversível de leads.
-- Os IDs internos das etapas permanecem fixos para não quebrar métricas e integrações.

alter table public.leads
  add column if not exists arquivado boolean not null default false;

create index if not exists leads_empresa_arquivado_etapa_idx
  on public.leads (empresa_id, arquivado, etapa);

create table if not exists public.configuracao_comercial (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  etapas_labels jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  constraint configuracao_comercial_etapas_labels_objeto
    check (jsonb_typeof(etapas_labels) = 'object')
);

alter table public.configuracao_comercial enable row level security;

drop policy if exists "configuracao_comercial_select" on public.configuracao_comercial;
drop policy if exists "configuracao_comercial_insert" on public.configuracao_comercial;
drop policy if exists "configuracao_comercial_update" on public.configuracao_comercial;
drop policy if exists "configuracao_comercial_delete" on public.configuracao_comercial;

create policy "configuracao_comercial_select"
  on public.configuracao_comercial for select to authenticated
  using (empresa_id = public.minha_empresa_id());

create policy "configuracao_comercial_insert"
  on public.configuracao_comercial for insert to authenticated
  with check (empresa_id = public.minha_empresa_id());

create policy "configuracao_comercial_update"
  on public.configuracao_comercial for update to authenticated
  using (empresa_id = public.minha_empresa_id())
  with check (empresa_id = public.minha_empresa_id());

create policy "configuracao_comercial_delete"
  on public.configuracao_comercial for delete to authenticated
  using (empresa_id = public.minha_empresa_id());
