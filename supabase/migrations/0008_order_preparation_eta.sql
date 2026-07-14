-- Yamo — ajoute l'engagement de préparation restaurant par commande.
-- Le restaurant confirme une commande avec un délai, visible côté client et livreur.

alter table orders add column if not exists confirmed_at timestamptz;
alter table orders add column if not exists preparation_eta_minutes integer;
alter table orders add column if not exists estimated_ready_at timestamptz;
alter table orders add column if not exists ready_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_preparation_eta_minutes_check'
  ) then
    alter table orders add constraint orders_preparation_eta_minutes_check
      check (preparation_eta_minutes is null or preparation_eta_minutes between 1 and 240);
  end if;
end $$;

create index if not exists orders_estimated_ready_at_idx on orders (estimated_ready_at);
create index if not exists orders_restaurant_status_ready_idx on orders (restaurant_id, status, estimated_ready_at);