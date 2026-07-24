-- Empresas prospectadas continuam sendo a entidade de vínculo do CRM, mas não
-- aparecem como clientes operacionais até uma promoção explícita.
alter table public.clientes_comercial
  add column if not exists cliente_ativo boolean not null default true;

create index if not exists clientes_comercial_cliente_ativo_idx
  on public.clientes_comercial (empresa_id, cliente_ativo, nome);
