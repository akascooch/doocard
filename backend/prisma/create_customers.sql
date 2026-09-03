-- First, make sure we're using the right schema
SET search_path TO public;

-- Create the users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'CUSTOMER',
    "firstName" VARCHAR(255) NOT NULL,
    "lastName" VARCHAR(255) NOT NULL,
    "phoneNumber" VARCHAR(255) UNIQUE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample customers (password is '123456' for all users)
INSERT INTO users (email, password, role, "firstName", "lastName", "phoneNumber", "isActive")
VALUES 
    ('ali@example.com', '$2b$10$cBUdfhFkcjXLfbtl0dDMi.wcF/jt68PPoqbxh9ledU4jeSVCNIiKu', 'CUSTOMER', 'علی', 'مشتری', '09123333333', true),
    ('reza@example.com', '$2b$10$cBUdfhFkcjXLfbtl0dDMi.wcF/jt68PPoqbxh9ledU4jeSVCNIiKu', 'CUSTOMER', 'رضا', 'مشتری', '09124444444', true),
    ('mohammad@example.com', '$2b$10$cBUdfhFkcjXLfbtl0dDMi.wcF/jt68PPoqbxh9ledU4jeSVCNIiKu', 'CUSTOMER', 'محمد', 'مشتری', '09125555555', true),
    ('admin@example.com', '$2b$10$cBUdfhFkcjXLfbtl0dDMi.wcF/jt68PPoqbxh9ledU4jeSVCNIiKu', 'ADMIN', 'مدیر', 'سیستم', '09120000000', true),
    ('barber1@example.com', '$2b$10$cBUdfhFkcjXLfbtl0dDMi.wcF/jt68PPoqbxh9ledU4jeSVCNIiKu', 'BARBER', 'علی', 'آرایشگر', '09121111111', true),
    ('barber2@example.com', '$2b$10$cBUdfhFkcjXLfbtl0dDMi.wcF/jt68PPoqbxh9ledU4jeSVCNIiKu', 'BARBER', 'رضا', 'آرایشگر', '09122222222', true);

-- Create profiles table for barbers
CREATE TABLE IF NOT EXISTS profiles (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER UNIQUE NOT NULL,
    avatar TEXT,
    bio TEXT,
    specialties TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES users(id)
);

-- Insert barber profiles
INSERT INTO profiles ("userId", bio, specialties)
VALUES 
    (5, 'آرایشگر با 5 سال سابقه', ARRAY['اصلاح مو', 'اصلاح صورت']),
    (6, 'آرایشگر با 3 سال سابقه', ARRAY['رنگ مو', 'اصلاح صورت']); 