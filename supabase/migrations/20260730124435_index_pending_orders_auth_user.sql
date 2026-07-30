create index if not exists pending_orders_auth_user_id_idx
  on public.pending_orders (auth_user_id)
  where auth_user_id is not null;
