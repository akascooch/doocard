-- Drop existing database if exists
DROP DATABASE IF EXISTS barbershop;

-- Create database
CREATE DATABASE barbershop;

-- Use the database
\c barbershop;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('ADMIN', 'BARBER', 'CUSTOMER');
CREATE TYPE appointment_status AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'CUSTOMER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create profiles table
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id),
    bio TEXT,
    avatar TEXT,
    specialties TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create services table
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create appointments table
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES users(id),
    service_id UUID NOT NULL REFERENCES services(id),
    barber_id UUID NOT NULL REFERENCES users(id),
    date DATE NOT NULL,
    time TIME NOT NULL,
    status appointment_status NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create settings table
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data

-- Insert users
INSERT INTO users (id, name, email, password, phone, role) VALUES
    (uuid_generate_v4(), 'مدیر سیستم', 'admin@example.com', '$2b$10$K.0HwpsoPDGaB/atFBmmXOGTw4ceeg33.WrxJx/FeC9.gCyYvN9je', '09123456789', 'ADMIN'),
    (uuid_generate_v4(), 'آرایشگر ۱', 'barber1@example.com', '$2b$10$K.0HwpsoPDGaB/atFBmmXOGTw4ceeg33.WrxJx/FeC9.gCyYvN9je', '09123456788', 'BARBER'),
    (uuid_generate_v4(), 'آرایشگر ۲', 'barber2@example.com', '$2b$10$K.0HwpsoPDGaB/atFBmmXOGTw4ceeg33.WrxJx/FeC9.gCyYvN9je', '09123456787', 'BARBER'),
    (uuid_generate_v4(), 'علی محمدی', 'ali@example.com', '$2b$10$K.0HwpsoPDGaB/atFBmmXOGTw4ceeg33.WrxJx/FeC9.gCyYvN9je', '09123456786', 'CUSTOMER'),
    (uuid_generate_v4(), 'رضا احمدی', 'reza@example.com', '$2b$10$K.0HwpsoPDGaB/atFBmmXOGTw4ceeg33.WrxJx/FeC9.gCyYvN9je', '09123456785', 'CUSTOMER'),
    (uuid_generate_v4(), 'محمد حسینی', 'mohammad@example.com', '$2b$10$K.0HwpsoPDGaB/atFBmmXOGTw4ceeg33.WrxJx/FeC9.gCyYvN9je', '09123456784', 'CUSTOMER');

-- Insert profiles for barbers
INSERT INTO profiles (user_id, bio, specialties)
SELECT id, 
       CASE 
           WHEN name = 'آرایشگر ۱' THEN 'متخصص اصلاح مو و صورت با ۱۰ سال سابقه'
           WHEN name = 'آرایشگر ۲' THEN 'متخصص رنگ مو و شینیون با ۸ سال سابقه'
       END,
       CASE 
           WHEN name = 'آرایشگر ۱' THEN ARRAY['اصلاح مو', 'اصلاح صورت']
           WHEN name = 'آرایشگر ۲' THEN ARRAY['رنگ مو', 'شینیون']
       END
FROM users 
WHERE role = 'BARBER';

-- Insert services
INSERT INTO services (id, name, description, duration, price) VALUES
    (uuid_generate_v4(), 'اصلاح مو', 'اصلاح مو با متدهای روز دنیا', 30, 150000),
    (uuid_generate_v4(), 'اصلاح صورت', 'اصلاح صورت و ابرو', 20, 80000),
    (uuid_generate_v4(), 'رنگ مو', 'رنگ مو با برندهای معتبر', 90, 450000),
    (uuid_generate_v4(), 'اصلاح مو و صورت', 'اصلاح کامل مو و صورت', 45, 200000),
    (uuid_generate_v4(), 'شینیون', 'شینیون مو برای مراسم‌های خاص', 60, 350000);

-- Insert appointments
INSERT INTO appointments (customer_id, service_id, barber_id, date, time, status, notes)
SELECT 
    (SELECT id FROM users WHERE email = 'ali@example.com'),
    (SELECT id FROM services WHERE name = 'اصلاح مو'),
    (SELECT id FROM users WHERE email = 'barber1@example.com'),
    CURRENT_DATE,
    '10:00',
    'CONFIRMED',
    'نوبت اصلاح موی آقای محمدی';

INSERT INTO appointments (customer_id, service_id, barber_id, date, time, status, notes)
SELECT 
    (SELECT id FROM users WHERE email = 'reza@example.com'),
    (SELECT id FROM services WHERE name = 'اصلاح صورت'),
    (SELECT id FROM users WHERE email = 'barber2@example.com'),
    CURRENT_DATE,
    '11:30',
    'PENDING',
    'نوبت اصلاح صورت آقای احمدی';

-- Insert settings
INSERT INTO settings (key, value) VALUES
    ('salon_name', 'آرایشگاه مدرن'),
    ('sms_notifications_enabled', 'true'),
    ('email_notifications_enabled', 'true'),
    ('auto_backup_enabled', 'true'),
    ('theme', 'dark');

-- Insert notifications
INSERT INTO notifications (user_id, title, message, type, status)
SELECT 
    (SELECT id FROM users WHERE email = 'ali@example.com'),
    'یادآوری نوبت',
    'نوبت شما برای فردا ساعت ۱۰:۰۰ تایید شد.',
    'sms',
    'sent';

-- Insert sample transactions
INSERT INTO transactions (appointment_id, amount, status)
SELECT 
    id,
    (SELECT price FROM services WHERE id = service_id),
    CASE 
        WHEN status = 'COMPLETED' THEN 'paid'
        ELSE 'pending'
    END
FROM appointments; 