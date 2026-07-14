-- Yamo — recalcule automatiquement restaurants.rating / review_count
-- Les clients notent un restaurant via restaurant_reviews (0009), mais rien
-- ne remettait à jour la note affichée sur la fiche restaurant : elle
-- restait figée à la valeur de création (souvent 0). On ajoute un trigger
-- qui recalcule la moyenne à chaque avis inséré, modifié ou supprimé.

create or replace function recompute_restaurant_rating()
returns trigger
language plpgsql
security definer
as $$
declare
  target_restaurant_id uuid := coalesce(new.restaurant_id, old.restaurant_id);
  avg_rating numeric;
  total integer;
begin
  select round(avg(rating)::numeric, 1), count(*)
    into avg_rating, total
    from restaurant_reviews
    where restaurant_id = target_restaurant_id;

  update restaurants
    set rating = coalesce(avg_rating, 0),
        review_count = coalesce(total, 0)
    where id = target_restaurant_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists restaurant_reviews_recompute_rating on restaurant_reviews;
create trigger restaurant_reviews_recompute_rating
  after insert or update or delete on restaurant_reviews
  for each row
  execute function recompute_restaurant_rating();
