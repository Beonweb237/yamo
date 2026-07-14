-- Yamo — zones de service livreur : un livreur candidate avec une ville et,
-- optionnellement, une liste de quartiers précis (vide/absent = toute la
-- ville). Ces informations sont copiées de sa candidature vers son profil à
-- l'approbation (voir src/lib/applications.ts) et bornent les livraisons
-- qu'il peut voir/accepter — garde-fou applicatif (fetchAvailableDeliveries)
-- ET garde-fou base de données (trigger ci-dessous) pour qu'un appel API
-- direct ne puisse pas contourner la zone.

alter table applications add column if not exists service_neighborhoods text[];
alter table profiles add column if not exists city text;
alter table profiles add column if not exists service_neighborhoods text[];

create or replace function check_driver_zone_match()
returns trigger
language plpgsql
security definer
as $$
declare
  driver_city text;
  driver_zones text[];
  order_restaurant_city text;
  order_restaurant_neighborhood text;
begin
  select city, service_neighborhoods into driver_city, driver_zones
    from profiles
    where id = new.driver_id;

  select r.city, r.neighborhood into order_restaurant_city, order_restaurant_neighborhood
    from orders o
    join restaurants r on r.id = o.restaurant_id
    where o.id = new.order_id;

  -- Pas de ville enregistrée côté livreur (comptes de démo/anciens) : on ne
  -- bloque pas, faute de donnée pour trancher.
  if driver_city is not null and order_restaurant_city is not null
     and driver_city <> order_restaurant_city then
    raise exception 'Zone mismatch: driver is registered in %, order restaurant is in %',
      driver_city, order_restaurant_city;
  end if;

  if driver_zones is not null and array_length(driver_zones, 1) > 0
     and order_restaurant_neighborhood is not null
     and not (order_restaurant_neighborhood = any(driver_zones)) then
    raise exception 'Zone mismatch: order restaurant neighborhood % is outside driver service zones',
      order_restaurant_neighborhood;
  end if;

  return new;
end;
$$;

drop trigger if exists deliveries_check_driver_zone on deliveries;
create trigger deliveries_check_driver_zone
  before insert on deliveries
  for each row
  execute function check_driver_zone_match();
