-- Yamo — Phase 2 : accès restaurant (gérer ses commandes) et livreur
-- (livraisons disponibles, acceptation, suivi) à ajouter après 0001_init.sql

-- Restaurateur : lit et met à jour les commandes de son propre restaurant
create policy "orders: restaurant owner reads own orders" on orders
  for select using (
    exists (select 1 from restaurants r where r.id = orders.restaurant_id and r.owner_id = auth.uid())
  );

create policy "orders: restaurant owner updates own orders" on orders
  for update using (
    exists (select 1 from restaurants r where r.id = orders.restaurant_id and r.owner_id = auth.uid())
  );

-- Livreur : voit le pool de commandes prêtes et non encore assignées
create policy "orders: drivers see ready unassigned orders" on orders
  for select using (
    status = 'ready' and not exists (
      select 1 from deliveries d where d.order_id = orders.id and d.driver_id is not null
    )
  );

-- Livreur : voit et met à jour les commandes qui lui sont assignées
create policy "orders: assigned driver reads their order" on orders
  for select using (
    exists (select 1 from deliveries d where d.order_id = orders.id and d.driver_id = auth.uid())
  );

create policy "orders: assigned driver updates their order" on orders
  for update using (
    exists (select 1 from deliveries d where d.order_id = orders.id and d.driver_id = auth.uid())
  );

-- Table deliveries : n'était pas encore protégée par RLS dans 0001_init.sql
alter table deliveries enable row level security;

create policy "deliveries: driver reads own deliveries" on deliveries
  for select using (auth.uid() = driver_id);

create policy "deliveries: driver accepts a delivery" on deliveries
  for insert with check (auth.uid() = driver_id);

create policy "deliveries: driver updates own delivery" on deliveries
  for update using (auth.uid() = driver_id);
