SELECT phone, email, password_hash IS NOT NULL AS has_password FROM users WHERE role='restaurant' ORDER BY phone;
