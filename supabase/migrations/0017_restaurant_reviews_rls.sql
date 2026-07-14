-- Yamo — sécurise restaurant_reviews (0009 créait la table sans RLS ni
-- politiques : sans RLS, une table Postgres reste accessible selon les
-- privilèges de schéma accordés aux rôles anon/authenticated par Supabase,
-- ce qui laissait n'importe qui lire/insérer/modifier des avis. On active
-- RLS avec un accès en lecture publique (confiance/marketing) et une
-- écriture restreinte au client authentifié, pour son propre avis.

alter table restaurant_reviews enable row level security;

create policy "restaurant_reviews: public read" on restaurant_reviews
  for select using (true);

create policy "restaurant_reviews: customer creates own" on restaurant_reviews
  for insert with check (auth.uid() = customer_id);
