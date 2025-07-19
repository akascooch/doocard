-- ایجاد انواع مورد نیاز
DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('ADMIN', 'BARBER', 'CUSTOMER');
    CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');
    CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- جدول کاربران
CREATE TABLE IF NOT EXISTS "users" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- جدول پروفایل‌ها
CREATE TABLE IF NOT EXISTS "profiles" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID UNIQUE NOT NULL,
    "bio" TEXT,
    "avatar" TEXT,
    "specialties" TEXT[],
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- جدول خدمات
CREATE TABLE IF NOT EXISTS "services" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "duration" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- جدول نوبت‌ها
CREATE TABLE IF NOT EXISTS "appointments" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "barber_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "time" TIME NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE,
    FOREIGN KEY ("barber_id") REFERENCES "users"("id") ON DELETE CASCADE,
    FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE
);

-- جدول تراکنش‌ها
CREATE TABLE IF NOT EXISTS "transactions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "appointment_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "payment_method" VARCHAR(50),
    "payment_ref" VARCHAR(100),
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE
);

-- جدول تنظیمات
CREATE TABLE IF NOT EXISTS "settings" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "key" VARCHAR(255) UNIQUE NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- جدول اعلان‌ها
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- وارد کردن داده‌های اولیه

-- کاربران
INSERT INTO "users" ("email", "password", "name", "role") VALUES
('admin@example.com', '$2b$10$zPj5YPacYqVVl1nqYoGdWOjcyTXUqkKxk1Qv0soCnqPdNQyqvzEIS', 'مدیر سیستم', 'ADMIN'),
('barber1@example.com', '$2b$10$zPj5YPacYqVVl1nqYoGdWOjcyTXUqkKxk1Qv0soCnqPdNQyqvzEIS', 'علی آرایشگر', 'BARBER'),
('barber2@example.com', '$2b$10$zPj5YPacYqVVl1nqYoGdWOjcyTXUqkKxk1Qv0soCnqPdNQyqvzEIS', 'رضا آرایشگر', 'BARBER'),
('ali@example.com', '$2b$10$zPj5YPacYqVVl1nqYoGdWOjcyTXUqkKxk1Qv0soCnqPdNQyqvzEIS', 'علی مشتری', 'CUSTOMER'),
('reza@example.com', '$2b$10$zPj5YPacYqVVl1nqYoGdWOjcyTXUqkKxk1Qv0soCnqPdNQyqvzEIS', 'رضا مشتری', 'CUSTOMER'),
('mohammad@example.com', '$2b$10$zPj5YPacYqVVl1nqYoGdWOjcyTXUqkKxk1Qv0soCnqPdNQyqvzEIS', 'محمد مشتری', 'CUSTOMER')
ON CONFLICT (email) DO NOTHING;

-- پروفایل آرایشگرها
INSERT INTO "profiles" ("user_id", "bio", "specialties")
SELECT id, 'آرایشگر با 5 سال سابقه', ARRAY['اصلاح مو', 'اصلاح صورت']
FROM "users" WHERE email = 'barber1@example.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO "profiles" ("user_id", "bio", "specialties")
SELECT id, 'آرایشگر با 3 سال سابقه', ARRAY['رنگ مو', 'اصلاح صورت']
FROM "users" WHERE email = 'barber2@example.com'
ON CONFLICT (user_id) DO NOTHING;

-- خدمات
INSERT INTO "services" ("name", "description", "duration", "price") VALUES
('اصلاح مو', 'اصلاح مو به سبک کلاسیک یا مدرن', 30, 50000),
('اصلاح صورت', 'اصلاح صورت و ریش', 20, 30000),
('رنگ مو', 'رنگ مو با بهترین برندها', 60, 150000),
('پاکسازی صورت', 'پاکسازی عمیق پوست صورت', 45, 200000),
('ماساژ سر و صورت', 'ماساژ تخصصی سر و صورت', 30, 100000),
('براشینگ مو', 'براشینگ و حالت دهی مو', 40, 120000)
ON CONFLICT DO NOTHING;

-- نمونه تراکنش‌ها
WITH sample_appointment AS (
    INSERT INTO "appointments" ("customer_id", "barber_id", "service_id", "date", "time", "status")
    SELECT 
        c.id as customer_id,
        b.id as barber_id,
        s.id as service_id,
        CURRENT_DATE,
        '10:00:00'::TIME,
        'COMPLETED'
    FROM 
        "users" c,
        "users" b,
        "services" s
    WHERE 
        c.email = 'ali@example.com'
        AND b.email = 'barber1@example.com'
        AND s.name = 'اصلاح مو'
    RETURNING id
)
INSERT INTO "transactions" ("appointment_id", "amount", "status", "payment_method")
SELECT 
    id,
    50000,
    'COMPLETED',
    'نقدی'
FROM sample_appointment; 