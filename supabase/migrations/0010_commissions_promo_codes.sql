-- Yamo — ledger de commissions + codes promo
-- Business plan §8 : commission restaurant (15% par défaut, modulable par
-- restaurant) enregistrée par commande livrée ; codes promo par zone (§12).

-- ─────────────────────────────────────────────────────────────
-- Taux de commission par restaurant (fraction, ex: 0.15 = 15%)
-- ─────────────────────────────────────────────────────────────
alter table restaurants
  add column if not exists commission_rate numeric(4,3) not null default 0.150
  check (commission_rate >= 0 and commission_rate <= 0.30);

-- ─────────────────────────────────────────────────────────────
-- Ledger : une ligne de commission par commande livrée.
-- Alimenté automatiquement par trigger au passage en 'delivered'.
-- ─────────────────────────────────────────────────────────────
create table if not exists order_commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders (id) on delete cascade,
  restaurant_id uuid not null references restaurants (id),
  subtotal integer not null,            -- montant plats (hors livraison)
  commission_rate numeric(4,3) not null,
  commission_amount integer not null,   -- arrondi en FCFA
  created_at timestamptz not null default now()
);

alter table order_commissions enable row level security;

create policy "order_commissions: admin full access" on order_commissions
  for all using (is_admin());

create policy "order_commissions: restaurant reads own" on order_commissions
  for select using (
    exists (
      select 1 from restaurants r
      where r.id = order_commissions.restaurant_id and r.owner_id = auth.uid()
    )
  );

create or replace function record_order_commission()
returns trigger
language plpgsql
security definer
as $$
declare
  rate numeric(4,3);
begin
  -- Uniquement à la première transition vers 'delivered'
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    select commission_rate into rate from restaurants where id = new.restaurant_id;
    insert into order_commissions (order_id, restaurant_id, subtotal, commission_rate, commission_amount)
    values (
      new.id,
      new.restaurant_id,
      new.subtotal,
      coalesce(rate, 0.150),
      round(new.subtotal * coalesce(rate, 0.150))
    )
    on conflict (order_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_record_commission on orders;
create trigger orders_record_commission
  after update of status on orders
  for each row
  execute function record_order_commission();

-- ─────────────────────────────────────────────────────────────
-- Codes promo (campagnes de lancement par quartier : AKWA1000…)
-- Validés côté serveur par l'edge function validate-order
-- (service role — pas de lecture publique).
-- ─────────────────────────────────────────────────────────────
create type promo_discount_type as enum ('amount', 'percent');

create table if not exists promo_codes (
  code text primary key,                       -- stocké en MAJUSCULES
  discount_type promo_discount_type not null default 'amount',
  discount_value integer not null check (discount_value > 0),  -- FCFA ou %
  min_subtotal integer not null default 0,
  max_uses integer,                            -- null = illimité
  use_count integer not null default 0,
  is_active boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now()
);

alter table promo_codes enable row level security;

create policy "promo_codes: admin full access" on promo_codes
  for all using (is_admin());

-- Compteur d'utilisation : appelé par validate-order/momo-payment via service role
create or replace function increment_promo_use(p_code text)
returns void
language sql
security definer
as $$
  update promo_codes set use_count = use_count + 1 where code = upper(p_code);
$$;
