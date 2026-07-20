-- Seed VPS MiamExpress v3 (all variables prefixed with v_)
DO $$
DECLARE
  v_r1 uuid:='eab46a3d-19db-4daf-b1e3-2186af624f27'; v_r2 uuid:='d2f75c2b-f7dd-46d6-8056-923a143f56ed';
  v_r3 uuid:='af559190-5a07-4f87-88f5-8bcebf12cc2f'; v_r4 uuid:='8ec8040d-6100-429a-89a2-2b35b16c1e40';
  v_r5 uuid:='6aee5b31-b7b3-4573-be9c-734e392cfe5d'; v_r6 uuid:='b095823a-b01a-45b1-92ec-bf91fc16eab8';
  v_r7 uuid:='a08788e0-2f20-4c69-b4c0-d166ad8bd2e9'; v_r8 uuid:='b11c3d48-4409-4f84-aa50-59ac5352e2c1';
  v_r9 uuid:='1cb5156c-1ba0-46cb-9f2d-46bf6e32c07a'; v_r10 uuid:='b73df0b0-945f-4acf-bd5d-eb7cdf54277b';
  v_existing int; v_to_create int; v_i int; v_j int;
  v_oid uuid; v_status text; v_pay_method text; v_pay_status text;
  v_resto uuid; v_client uuid; v_driver uuid;
  v_subtotal int; v_dfee int; v_total int;
  v_created_at timestamptz;
  v_items uuid[]; v_price int; v_name text; v_qty int;
  v_rating int; v_arr uuid[]; v_idx int;
BEGIN
  INSERT INTO users (phone,role,full_name,is_approved,is_online,city,service_neighborhoods)
  SELECT '+237677000004','livreur','Franck Biya',true,true,'Douala',ARRAY['Akwa','Bonapriso','Deido']
  WHERE NOT EXISTS (SELECT 1 FROM users WHERE phone='+237677000004');
  INSERT INTO users (phone,role,full_name,is_approved,is_online,city,service_neighborhoods)
  SELECT '+237677000005','livreur','Georges Mbah',true,true,'Douala',ARRAY['Makepe','Bali','Logpom']
  WHERE NOT EXISTS (SELECT 1 FROM users WHERE phone='+237677000005');
  INSERT INTO users (phone,role,full_name,is_approved,is_online,city,service_neighborhoods)
  SELECT '+237677000006','livreur','Helene Nkotto',true,true,'Yaounde',ARRAY['Bastos','Omnisport','Mvan']
  WHERE NOT EXISTS (SELECT 1 FROM users WHERE phone='+237677000006');
  INSERT INTO users (phone,role,full_name,is_approved,is_online,city,service_neighborhoods)
  SELECT '+237677000007','livreur','Irene Zanga',true,false,'Yaounde',ARRAY['Mokolo','Biyem-Assi','Essos']
  WHERE NOT EXISTS (SELECT 1 FROM users WHERE phone='+237677000007');
  INSERT INTO users (phone,role,full_name,is_approved,is_suspended,city,service_neighborhoods)
  SELECT '+237677000008','livreur','Jean-Pierre Ngassa',true,true,'Yaounde',ARRAY['Nlongkak','Elig-Essono','Odza']
  WHERE NOT EXISTS (SELECT 1 FROM users WHERE phone='+237677000008');
  RAISE NOTICE 'Drivers OK';

  SELECT count(*) INTO v_existing FROM orders;
  v_to_create := 100 - v_existing;
  IF v_to_create <= 0 THEN RAISE NOTICE '% orders existants', v_existing; RETURN; END IF;

  v_arr := ARRAY(SELECT id FROM users WHERE role='client' ORDER BY created_at DESC LIMIT 15);

  FOR v_i IN 1..v_to_create LOOP
    v_idx := (v_i * 7) % 100;
    IF v_idx < 55 THEN v_status := 'delivered';
    ELSIF v_idx < 63 THEN v_status := 'cancelled';
    ELSIF v_idx < 69 THEN v_status := 'pending';
    ELSIF v_idx < 75 THEN v_status := 'confirmed';
    ELSIF v_idx < 81 THEN v_status := 'preparing';
    ELSIF v_idx < 87 THEN v_status := 'ready';
    ELSIF v_idx < 93 THEN v_status := 'delivering';
    ELSE v_status := 'picked_up'; END IF;

    v_client := v_arr[1 + ((v_i * 3) % array_length(v_arr, 1))];
    CASE (v_i * 7) % 10
      WHEN 0 THEN v_resto := v_r1; WHEN 1 THEN v_resto := v_r2;
      WHEN 2 THEN v_resto := v_r3; WHEN 3 THEN v_resto := v_r4;
      WHEN 4 THEN v_resto := v_r5; WHEN 5 THEN v_resto := v_r6;
      WHEN 6 THEN v_resto := v_r7; WHEN 7 THEN v_resto := v_r8;
      WHEN 8 THEN v_resto := v_r9; WHEN 9 THEN v_resto := v_r10;
    END CASE;

    SELECT ARRAY_AGG(id) INTO v_items FROM menu_items WHERE restaurant_id = v_resto;
    v_subtotal := 1500 + ((v_i * 500) % 5000);
    v_dfee := CASE WHEN (v_i % 4) = 0 THEN 0 ELSE 500 + ((v_i * 200) % 500) END;
    v_total := v_subtotal + v_dfee;

    IF v_status = 'delivered' THEN v_created_at := now() - ((10 + (v_i % 50)) * interval '1 day') - ((v_i * 13) % 1440) * interval '1 minute';
    ELSIF v_status = 'cancelled' THEN v_created_at := now() - ((v_i % 15) * interval '1 day') - ((v_i * 7) % 1440) * interval '1 minute';
    ELSE v_created_at := now() - ((v_i % 3) * interval '1 day') - ((v_i * 11) % 1440) * interval '1 minute'; END IF;

    v_idx := 1 + ((v_i * 2) % 4);
    IF v_idx IN (1,2) THEN v_pay_method := 'cash'; ELSIF v_idx = 3 THEN v_pay_method := 'mtn_momo'; ELSE v_pay_method := 'orange_money'; END IF;

    IF v_status = 'cancelled' THEN v_pay_status := 'refunded';
    ELSIF v_status IN ('delivered','delivering','ready','picked_up') THEN v_pay_status := 'paid';
    ELSE v_pay_status := CASE WHEN (v_i * 5) % 4 < 3 THEN 'paid' ELSE 'pending' END; END IF;

    INSERT INTO orders (customer_id,restaurant_id,status,subtotal,delivery_fee,total,payment_method,payment_status,contact_phone,ordered_for_someone_else,recipient_name,recipient_phone,notes,preparation_eta_minutes,confirmed_at,created_at,updated_at)
    VALUES (v_client,v_resto,v_status::order_status,v_subtotal,v_dfee,v_total,v_pay_method::payment_method,v_pay_status::payment_status,
      (SELECT phone FROM users WHERE id = v_client),
      (v_i % 8 = 0),
      CASE WHEN v_i % 8 = 0 THEN (ARRAY['Maman Rose','Tonton Jean','Cousine Alice','Grand-pere Joseph'])[1 + ((v_i/8) % 4)] ELSE NULL END,
      CASE WHEN v_i % 8 = 0 THEN '+2376900000' || (10 + (v_i % 10)) ELSE NULL END,
      CASE WHEN v_i % 7 = 0 THEN (ARRAY['Sans piment sauce a part','Cuisson bien cuite remplacer riz','Livraison 13h-14h','Beaucoup sauce extra piment','Remplacer poulet par poisson'])[1 + ((v_i/7) % 5)] ELSE NULL END,
      CASE WHEN v_status != 'pending' THEN 20 + (v_i % 20) ELSE NULL END,
      CASE WHEN v_status != 'pending' THEN v_created_at + interval '3 minutes' ELSE NULL END,
      v_created_at, v_created_at + interval '2 minutes'
    ) RETURNING id INTO v_oid;

    IF array_length(v_items,1) > 0 THEN
      FOR v_j IN 1..LEAST(array_length(v_items,1), 1 + (v_i % 3)) LOOP
        SELECT price,name INTO v_price,v_name FROM menu_items WHERE id = v_items[1 + ((v_i*v_j*7) % array_length(v_items,1))];
        v_qty := 1 + ((v_i * v_j) % 3);
        INSERT INTO order_items (order_id,menu_item_id,price,quantity,name) VALUES (v_oid,v_items[1 + ((v_i*v_j*7) % array_length(v_items,1))],v_price,v_qty,v_name);
      END LOOP;
    END IF;

    IF v_pay_method != 'cash' THEN
      INSERT INTO payments (order_id,provider,amount,phone,status) VALUES (v_oid,'chariow',v_total,(SELECT phone FROM users WHERE id = v_client),v_pay_status);
    END IF;

    IF v_status IN ('delivered','delivering','ready','picked_up') THEN
      IF v_resto IN (v_r1,v_r2,v_r3,v_r4) THEN
        SELECT id INTO v_driver FROM users WHERE role='livreur' AND city='Douala' ORDER BY random() LIMIT 1;
      ELSIF v_resto IN (v_r5,v_r6,v_r7) THEN
        SELECT id INTO v_driver FROM users WHERE role='livreur' AND city='Yaounde' ORDER BY random() LIMIT 1;
      ELSE SELECT id INTO v_driver FROM users WHERE role='livreur' ORDER BY random() LIMIT 1; END IF;

      UPDATE orders SET driver_id = v_driver WHERE id = v_oid;
      INSERT INTO deliveries (order_id,driver_id,status,assigned_at,picked_up_at,delivered_at)
      VALUES (v_oid,v_driver,
        CASE WHEN v_status='delivered' THEN 'delivered' WHEN v_status='picked_up' THEN 'picked_up' WHEN v_status='ready' THEN 'assigned' ELSE 'picked_up' END,
        v_created_at + interval '15 min', v_created_at + interval '30 min',
        CASE WHEN v_status='delivered' THEN v_created_at + interval '55 min' ELSE NULL END);
    END IF;

    IF v_status = 'delivered' AND (v_i % 4 != 0) THEN
      v_rating := 1 + ((v_i * 13) % 5);
      INSERT INTO reviews (order_id,customer_id,restaurant_id,target_type,target_id,rating,comment,tags,author_name,is_verified_order,is_test,status)
      VALUES (v_oid,v_client,v_resto,'restaurant',v_resto::text,v_rating,
        CASE v_rating WHEN 5 THEN 'Excellent repas livraison rapide !' WHEN 4 THEN 'Tres bon plat delicieux.'
          WHEN 3 THEN 'Correct bon gout mais leger retard.' WHEN 2 THEN 'Decu commande incomplete.'
          WHEN 1 THEN 'Mauvaise experience plat froid et en retard.' END,
        CASE WHEN v_rating >= 4 THEN ARRAY['rapide','chaud'] ELSE ARRAY['en retard'] END,
        'Client',true,true,'published')
      ON CONFLICT (order_id,target_type,target_id,COALESCE(dish_id,'')) DO NOTHING;
    END IF;
  END LOOP;
  RAISE NOTICE 'Seed termine: % nouvelles commandes', v_to_create;
END $$;

SELECT '--- RAPPORT FINAL ---' AS " ";
SELECT role, count(*) AS nb FROM users GROUP BY role ORDER BY role;
SELECT '---' AS " ";
SELECT city, count(*) AS nb FROM users WHERE role='livreur' GROUP BY city ORDER BY city;
SELECT '---' AS " ";
SELECT full_name, phone, city, is_online, is_suspended FROM users WHERE role='livreur' ORDER BY city, full_name;
SELECT '---' AS " ";
SELECT status, count(*) AS nb FROM orders GROUP BY status ORDER BY count DESC;
SELECT '---' AS " ";
SELECT count(*) AS total_orders FROM orders;
SELECT '---' AS " ";
SELECT status, count(*) AS nb FROM payments GROUP BY status;
SELECT '---' AS " ";
SELECT count(*) AS total_reviews FROM reviews;
SELECT '---' AS " ";
SELECT count(*) AS total_deliveries FROM deliveries;
