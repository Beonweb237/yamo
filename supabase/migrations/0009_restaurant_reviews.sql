-- Yamo — restaurant reviews (clients rate the restaurant after delivery).
-- Independent from delivery/driver ratings.

create table if not exists restaurant_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  customer_id uuid not null references profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),

  -- One review per order (a client can only review a restaurant once per order)
  unique(order_id)
);

create index if not exists restaurant_reviews_restaurant_id_idx on restaurant_reviews (restaurant_id, created_at desc);
