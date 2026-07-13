-- Yamo — Phase 4 : back-office admin
-- (vue globale des commandes, gestion des restaurants) à ajouter après 0002.

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

create policy "orders: admin full read" on orders
  for select using (is_admin());

create policy "orders: admin full update" on orders
  for update using (is_admin());

create policy "order_items: admin full read" on order_items
  for select using (is_admin());

create policy "deliveries: admin full read" on deliveries
  for select using (is_admin());

create policy "profiles: admin full read" on profiles
  for select using (is_admin());

-- Le restaurateur peut gérer (ouvrir/fermer, éditer) son propre restaurant ;
-- l'admin peut gérer n'importe quel restaurant.
create policy "restaurants: owner updates own restaurant" on restaurants
  for update using (owner_id = auth.uid());

create policy "restaurants: admin full update" on restaurants
  for update using (is_admin());

create policy "menu_items: owner manages own menu" on menu_items
  for all using (
    exists (select 1 from restaurants r where r.id = menu_items.restaurant_id and r.owner_id = auth.uid())
  );
