-- Yamo — restaurant photo gallery.
-- Each restaurant can have an array of image URLs for the gallery.

alter table restaurants add column if not exists gallery text[];
