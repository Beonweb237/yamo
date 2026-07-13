-- Yamo — permet à un restaurateur de "revendiquer" un restaurant sans propriétaire
-- (pas encore de vrai flux d'onboarding/validation ; à durcir avant un vrai lancement)
-- et de gérer son menu une fois propriétaire.

create policy "restaurants: claim unowned restaurant" on restaurants
  for update using (owner_id is null)
  with check (owner_id = auth.uid());
