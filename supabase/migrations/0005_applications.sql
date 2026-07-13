-- Yamo — candidatures restaurant/livreur + validation admin
-- Remplace l'auto-attribution de propriété (0004) par un vrai flux de vérification :
-- un compte "restaurant" ou "livreur" ne peut accéder à son espace qu'une fois
-- sa candidature approuvée par un admin (profiles.is_approved).

alter table profiles add column is_approved boolean not null default false;

-- Un admin doit pouvoir approuver/rejeter n'importe quel profil.
create policy "profiles: admin full update" on profiles
  for update using (is_admin());

create type application_type as enum ('restaurant', 'livreur');
create type application_status as enum ('pending', 'approved', 'rejected');

create table applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references profiles (id) on delete cascade,
  type application_type not null,
  status application_status not null default 'pending',
  restaurant_name text,
  city text,
  address text,
  contact_phone text,
  notes text,
  restaurant_id uuid references restaurants (id),
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table applications enable row level security;

create policy "applications: applicant reads own" on applications
  for select using (auth.uid() = applicant_id);

create policy "applications: applicant creates own" on applications
  for insert with check (auth.uid() = applicant_id);

create policy "applications: admin full access" on applications
  for all using (is_admin());
