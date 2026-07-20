-- Vérification de cohérence MiamExpress
SELECT '--- RESTAURANTS ---' AS info;
SELECT name, city, is_open FROM restaurants ORDER BY name;
SELECT '--- USERS (role restaurant) ---' AS info;
SELECT phone, full_name, is_approved, is_suspended FROM users WHERE role='restaurant' ORDER BY full_name;
SELECT '--- RESTAURANTS OPEN VS NOT ---' AS info;
SELECT is_open, count(*) FROM restaurants GROUP BY is_open;
SELECT '--- LIVREURS ---' AS info;
SELECT phone, full_name, city, is_approved, is_online, is_suspended FROM users WHERE role='livreur' ORDER BY city, full_name;
