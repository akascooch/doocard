-- اضافه کردن کاربران جدید
INSERT INTO users (id, email, password, name, role, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    email,
    password,
    name,
    role::role,
    NOW(),
    NOW()
FROM (VALUES 
    ('sara@example.com', '$2b$10$YourHashedPassword123', 'سارا مشتری', 'CUSTOMER'),
    ('mina@example.com', '$2b$10$YourHashedPassword123', 'مینا مشتری', 'CUSTOMER'),
    ('barber3@example.com', '$2b$10$YourHashedPassword123', 'محمد آرایشگر', 'BARBER')
) AS new_users(email, password, name, role)
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = new_users.email
);

-- اضافه کردن پروفایل برای آرایشگر جدید
WITH new_barber AS (
    SELECT id FROM users WHERE email = 'barber3@example.com'
)
INSERT INTO profiles (id, user_id, bio, specialties, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    new_barber.id,
    'آرایشگر با 7 سال سابقه',
    ARRAY['اصلاح مو', 'رنگ مو', 'اصلاح صورت'],
    NOW(),
    NOW()
FROM new_barber
WHERE EXISTS (
    SELECT 1 FROM new_barber
);

-- اضافه کردن خدمات جدید
INSERT INTO services (id, name, description, duration, price, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    name,
    description,
    duration,
    price,
    NOW(),
    NOW()
FROM (VALUES 
    ('پاکسازی صورت', 'پاکسازی عمیق پوست صورت', 45, 200000),
    ('ماساژ سر و صورت', 'ماساژ تخصصی سر و صورت', 30, 100000),
    ('براشینگ مو', 'براشینگ و حالت دهی مو', 40, 120000)
) AS new_services(name, description, duration, price)
WHERE NOT EXISTS (
    SELECT 1 FROM services WHERE name = new_services.name
); 