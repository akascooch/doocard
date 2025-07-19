CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    duration INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- نمونه داده‌های اولیه
INSERT INTO services (name, description, duration, price) VALUES
('اصلاح مو', 'اصلاح مو با متدهای روز دنیا', 30, 150000),
('اصلاح صورت', 'اصلاح صورت و ابرو', 20, 80000),
('رنگ مو', 'رنگ مو با برندهای معتبر', 90, 450000); 