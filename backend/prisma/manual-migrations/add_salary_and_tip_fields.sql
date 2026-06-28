-- Add missing fields to salaries table
ALTER TABLE salaries ADD COLUMN IF NOT EXISTS start_date TIMESTAMP;
ALTER TABLE salaries ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;
ALTER TABLE salaries ADD COLUMN IF NOT EXISTS salary_type VARCHAR(50) DEFAULT 'REGULAR';

-- Add missing fields to tip_transactions table
ALTER TABLE tip_transactions ADD COLUMN IF NOT EXISTS description TEXT;

-- Add missing fields to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50) DEFAULT 'SERVICE';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS barber_id INTEGER REFERENCES barbers(id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_barber_id ON transactions(barber_id);
CREATE INDEX IF NOT EXISTS idx_salaries_salary_type ON salaries(salary_type);
