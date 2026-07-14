-- Yamo — garde-fou base de données : un order_item doit appartenir au même
-- restaurant que la commande (orders.restaurant_id) sur laquelle il est inséré.
-- Jusqu'ici cette règle n'était appliquée que côté frontend (CartContext) —
-- rien n'empêchait techniquement d'insérer un plat d'un autre restaurant dans
-- order_items via un appel direct à l'API. Ce trigger rejette l'insertion si
-- le menu_item_id ne correspond pas au restaurant_id de la commande.

create or replace function check_order_item_restaurant()
returns trigger
language plpgsql
security definer
as $$
declare
  order_restaurant_id uuid;
  item_restaurant_id uuid;
begin
  -- No menu_item_id (e.g. a legacy/manual line item) — nothing to validate against.
  if new.menu_item_id is null then
    return new;
  end if;

  select restaurant_id into order_restaurant_id
    from orders
    where id = new.order_id;

  if order_restaurant_id is null then
    raise exception 'Order % not found', new.order_id;
  end if;

  select restaurant_id into item_restaurant_id
    from menu_items
    where id = new.menu_item_id;

  if item_restaurant_id is null then
    raise exception 'Menu item % not found', new.menu_item_id;
  end if;

  if item_restaurant_id <> order_restaurant_id then
    raise exception 'Menu item % belongs to a different restaurant than order %', new.menu_item_id, new.order_id;
  end if;

  return new;
end;
$$;

drop trigger if exists order_items_check_restaurant on order_items;
create trigger order_items_check_restaurant
  before insert on order_items
  for each row
  execute function check_order_item_restaurant();
