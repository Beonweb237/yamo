-- Yamo — Phase 5 : gestion des livreurs (statut en ligne, suspension,
-- notation de la livraison, demandes de virement).

alter table profiles add column is_online boolean not null default false;
alter table profiles add column is_suspended boolean not null default false;

alter table deliveries add column rating integer check (rating between 1 and 5);
alter table deliveries add column rating_comment text;

-- Le client peut noter sa propre livraison une fois qu'elle est terminée.
create policy "deliveries: customer rates own delivery" on deliveries
  for update using (
    exists (select 1 from orders o where o.id = deliveries.order_id and o.customer_id = auth.uid())
  );

-- profiles.is_suspended ne doit être modifiable que par un admin (la policy
-- "profiles: self update non-sensitive" de 0006 autorise déjà le livreur à
-- modifier is_online ; on étend le trigger anti-escalade pour protéger
-- is_suspended de la même façon que role/is_approved).
create or replace function prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = new.id and not is_admin() then
    if old.role is distinct from new.role
      or old.is_approved is distinct from new.is_approved
      or old.is_suspended is distinct from new.is_suspended then
      raise exception 'profile role, approval and suspension can only be changed by an admin';
    end if;
  end if;

  return new;
end;
$$;

create table payout_requests (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references profiles (id) on delete cascade,
  amount integer not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references profiles (id)
);

alter table payout_requests enable row level security;

create policy "payout_requests: driver reads own" on payout_requests
  for select using (auth.uid() = driver_id);

create policy "payout_requests: driver creates own" on payout_requests
  for insert with check (auth.uid() = driver_id);

create policy "payout_requests: admin full access" on payout_requests
  for all using (is_admin());
