-- Yamo — aligne l'enum PostgreSQL sur le flux commande du front.
alter type order_status add value if not exists 'picked_up' after 'ready';
