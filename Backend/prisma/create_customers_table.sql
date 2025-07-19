-- First, make sure we're using the right schema
SET search_path TO public;

-- Create the customers table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    "firstName" VARCHAR(255) NOT NULL,
    "lastName" VARCHAR(255) NOT NULL,
    "phoneNumber" VARCHAR(255) UNIQUE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample customers
INSERT INTO customers (email, "firstName", "lastName", "phoneNumber")
VALUES 
    ('ali@example.com', 'علی', 'مشتری', '09123333333'),
    ('reza@example.com', 'رضا', 'مشتری', '09124444444'),
    ('mohammad@example.com', 'محمد', 'مشتری', '09125555555'),
    ('sara@example.com', 'سارا', 'رضایی', '09126666666'),
    ('mina@example.com', 'مینا', 'محمدی', '09127777777'),
    ('hamid@example.com', 'حمید', 'حسینی', '09128888888'),
    ('amir@example.com', 'امیر', 'کریمی', '09129999999'),
    ('zahra@example.com', 'زهرا', 'علوی', '09121234567'),
    ('hossein@example.com', 'حسین', 'نوری', '09129876543'),
    ('fatemeh@example.com', 'فاطمه', 'صادقی', '09123456789'); 