-- Yamo — garde-fou base de données : un avis restaurant (restaurant_reviews)
-- ne peut être créé que si la commande liée est bien au statut 'delivered'.
-- Jusqu'ici cette règle n'était appliquée que côté frontend (Orders.tsx
-- n'affiche le bouton "Noter le restaurant" que pour les commandes livrées) —
-- rien n'empêchait techniquement un client d'insérer un avis via un appel
-- direct à l'API pour une commande encore en préparation ou annulée.

create or replace function check_review_order_delivered()
returns trigger
language plpgsql
security definer
as $$
declare
  order_status order_status;
begin
  select status into order_status
    from orders
    where id = new.order_id;

  if order_status is null then
    raise exception 'Order % not found', new.order_id;
  end if;

  if order_status <> 'delivered' then
    raise exception 'Cannot review order %: status is %, expected delivered', new.order_id, order_status;
  end if;

  return new;
end;
$$;

drop trigger if exists restaurant_reviews_check_delivered on restaurant_reviews;
create trigger restaurant_reviews_check_delivered
  before insert on restaurant_reviews
  for each row
  execute function check_review_order_delivered();
