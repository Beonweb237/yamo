-- Yamo — sécurité profils + onboarding admin.
-- À appliquer après 0005_applications.sql.

-- L'ancienne policy permettait à un utilisateur de modifier toute sa ligne
-- profiles, donc potentiellement son rôle. On la remplace par des règles plus
-- étroites et un trigger qui bloque les champs sensibles côté client.
drop policy if exists "profiles: self read/write" on profiles;
drop policy if exists "profiles: self read" on profiles;
drop policy if exists "profiles: self insert non-admin" on profiles;
drop policy if exists "profiles: self update non-sensitive" on profiles;

create policy "profiles: self read" on profiles
  for select using (auth.uid() = id);

create policy "profiles: self insert non-admin" on profiles
  for insert with check (
    auth.uid() = id
    and role <> 'admin'
    and is_approved = false
  );

create policy "profiles: self update non-sensitive" on profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = new.id and not is_admin() then
    if old.role is distinct from new.role or old.is_approved is distinct from new.is_approved then
      raise exception 'profile role and approval can only be changed by an admin';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_privilege_escalation on profiles;

create trigger prevent_profile_privilege_escalation
  before update on profiles
  for each row
  execute function prevent_profile_privilege_escalation();

-- Le flux candidatures remplace l'ancien claim libre d'un restaurant sans
-- propriétaire.
drop policy if exists "restaurants: claim unowned restaurant" on restaurants;

drop policy if exists "restaurants: admin insert" on restaurants;
create policy "restaurants: admin insert" on restaurants
  for insert with check (is_admin());
