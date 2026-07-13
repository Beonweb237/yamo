-- Yamo — schéma initial (Phase 0)
-- À exécuter dans le SQL editor de Supabase (ou via `supabase db push`).

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- Utilisateurs (étend auth.users de Supabase Auth)
-- ─────────────────────────────────────────────────────────────
create type user_role as enum ('client', 'restaurant', 'livreur', 'admin');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null default 'client',
  full_name text,
  phone text unique not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Restaurants & menu
-- ─────────────────────────────────────────────────────────────
create table restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles (id),
  name text not null,
  image text,
  category text not null,
  rating numeric(2,1) not null default 0,
  review_count integer not null default 0,
  delivery_time text,
  delivery_fee integer not null default 0,
  min_order integer not null default 0,
  price_range text,
  address text,
  phone text,
  hours text,
  is_open boolean not null default true,
  is_premium boolean not null default false,
  tags text[] not null default '{}',
  description text,
  created_at timestamptz not null default now()
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  name text not null,
  description text,
  price integer not null,
  category text not null,
  image text,
  is_popular boolean not null default false,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Adresses client (pas d'adressage postal fiable au Cameroun :
-- on garde un texte libre + un repère + une position GPS optionnelle)
-- ─────────────────────────────────────────────────────────────
create table addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  label text,
  city text not null,
  neighborhood text,
  landmark text,
  full_text text not null,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Commandes
-- ─────────────────────────────────────────────────────────────
create type order_status as enum (
  'pending', 'confirmed', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled'
);

create type payment_method as enum ('cash', 'mtn_momo', 'orange_money', 'card');
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded');

create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles (id),
  restaurant_id uuid not null references restaurants (id),
  address_id uuid references addresses (id),
  status order_status not null default 'pending',
  subtotal integer not null,
  delivery_fee integer not null default 0,
  total integer not null,
  payment_method payment_method not null default 'cash',
  payment_status payment_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  menu_item_id uuid references menu_items (id),
  name text not null,       -- snapshot du nom au moment de la commande
  price integer not null,   -- snapshot du prix au moment de la commande
  quantity integer not null check (quantity > 0)
);

create table deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders (id) on delete cascade,
  driver_id uuid references profiles (id),
  status text not null default 'unassigned',
  lat double precision,
  lng double precision,
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  method payment_method not null,
  amount integer not null,
  provider_reference text,
  status payment_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders (id),
  restaurant_id uuid not null references restaurants (id),
  customer_id uuid not null references profiles (id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security — chaque profil ne voit que ses propres données
-- (à affiner par rôle restaurant/livreur/admin dans une migration suivante)
-- ─────────────────────────────────────────────────────────────
alter table profiles enable row level security;
alter table addresses enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table reviews enable row level security;

create policy "profiles: self read/write" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "addresses: owner only" on addresses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "orders: customer reads own orders" on orders
  for select using (auth.uid() = customer_id);

create policy "orders: customer creates own orders" on orders
  for insert with check (auth.uid() = customer_id);

create policy "order_items: readable via parent order" on order_items
  for select using (
    exists (select 1 from orders o where o.id = order_items.order_id and o.customer_id = auth.uid())
  );

create policy "order_items: insertable via parent order" on order_items
  for insert with check (
    exists (select 1 from orders o where o.id = order_items.order_id and o.customer_id = auth.uid())
  );

create policy "reviews: customer manages own reviews" on reviews
  for all using (auth.uid() = customer_id) with check (auth.uid() = customer_id);

-- Restaurants et menu_items restent en lecture publique (catalogue vitrine)
alter table restaurants enable row level security;
alter table menu_items enable row level security;

create policy "restaurants: public read" on restaurants for select using (true);
create policy "menu_items: public read" on menu_items for select using (true);
