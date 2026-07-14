-- Yamo — colonnes manquantes sur applications
-- ApplicationForm.tsx envoie des documents (CNI, registre de commerce,
-- permis, assurance, photos) et AdminApplications.tsx envoie un motif de
-- rejet, mais la table créée en 0005 ne les portait pas encore : toute
-- soumission de candidature ou tout rejet échouait contre une vraie base
-- Supabase (colonne inconnue). On ajoute ce qui manque.

alter table applications add column if not exists id_document text;
alter table applications add column if not exists business_reg text;
alter table applications add column if not exists license_document text;
alter table applications add column if not exists insurance_document text;
alter table applications add column if not exists profile_photo text;
alter table applications add column if not exists vehicle_photo text;
alter table applications add column if not exists restaurant_photo text;
alter table applications add column if not exists rejection_reason text;
