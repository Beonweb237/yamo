-- Yamo — un livreur doit pouvoir "réclamer" une livraison déjà présente en
-- base sous forme de ligne `deliveries` non assignée (driver_id null) —
-- notamment les commandes 'ready' pré-créées par le seed de test, et tout
-- futur flux où le restaurant/la plateforme crée la ligne dès que la
-- commande passe 'ready'. La policy UPDATE existante (0002) n'autorisait que
-- `auth.uid() = driver_id`, ce qui exclut par construction la ligne tant que
-- personne ne l'a réclamée : un livreur ne pouvait donc jamais accepter une
-- de ces commandes (409 sur l'INSERT, RLS bloque l'UPDATE).
drop policy if exists "deliveries: driver updates own delivery" on deliveries;
create policy "deliveries: driver updates own delivery" on deliveries
  for update using (auth.uid() = driver_id or driver_id is null);
