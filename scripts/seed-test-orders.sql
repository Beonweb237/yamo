-- MiamExpress - Seed test data for reviews
BEGIN;

DO $$
DECLARE
  client_rec record;
  resto_rec record;
  menu_rec record;
  order_id uuid;
  order_count integer := 0;
BEGIN
  FOR client_rec IN (SELECT id FROM users WHERE role = 'client' LIMIT 3) LOOP
    FOR resto_rec IN (SELECT id FROM restaurants LIMIT 3) LOOP
      FOR i IN 1..2 LOOP
        INSERT INTO orders (customer_id, restaurant_id, status, subtotal, total, delivery_fee, created_at, updated_at)
        VALUES (
          client_rec.id,
          resto_rec.id,
          'delivered',
          3000 + (i * 1500),
          3500 + (i * 1500),
          500,
          now() - ((i * 24 + random()*12) || ' hours')::interval,
          now() - ((i * 12 + random()*6) || ' hours')::interval
        )
        RETURNING id INTO order_id;

        FOR menu_rec IN (SELECT id, name, 2500 AS price FROM menu_items WHERE restaurant_id = resto_rec.id LIMIT 2) LOOP
          INSERT INTO order_items (order_id, menu_item_id, name, price, quantity)
          VALUES (order_id, menu_rec.id, menu_rec.name, menu_rec.price, 1);
        END LOOP;
        
        order_count := order_count + 1;
      END LOOP;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Created % orders with items', order_count;
END $$;

SELECT count(*) as orders_created FROM orders WHERE status = 'delivered';
SELECT count(*) as items_created FROM order_items;

COMMIT;
