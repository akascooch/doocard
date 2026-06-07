-- PostgreSQL Migration Script
-- Copy data from mova database to zapas database

-- First, clear zapas database
TRUNCATE TABLE "Transaction" CASCADE;
TRUNCATE TABLE "FinancialEntry" CASCADE;
TRUNCATE TABLE "BarberWithdrawalRequest" CASCADE;
TRUNCATE TABLE "TipTransaction" CASCADE;
TRUNCATE TABLE "Salary" CASCADE;
TRUNCATE TABLE "AppointmentService" CASCADE;
TRUNCATE TABLE "Appointment" CASCADE;
TRUNCATE TABLE "Customer" CASCADE;
TRUNCATE TABLE "Barber" CASCADE;
TRUNCATE TABLE "Service" CASCADE;
TRUNCATE TABLE "User" CASCADE;
TRUNCATE TABLE "FinancialCategory" CASCADE;
TRUNCATE TABLE "BankAccount" CASCADE;
TRUNCATE TABLE "Setting" CASCADE;
TRUNCATE TABLE "Permission" CASCADE;
TRUNCATE TABLE "SmsLog" CASCADE;
TRUNCATE TABLE "SmsSettings" CASCADE;
TRUNCATE TABLE "SmsTemplate" CASCADE;
TRUNCATE TABLE "Profile" CASCADE;

-- Reset sequences
ALTER SEQUENCE "User_id_seq" RESTART WITH 1;
ALTER SEQUENCE "Profile_id_seq" RESTART WITH 1;
ALTER SEQUENCE "Barber_id_seq" RESTART WITH 1;
ALTER SEQUENCE "Service_id_seq" RESTART WITH 1;
ALTER SEQUENCE "Customer_id_seq" RESTART WITH 1;
ALTER SEQUENCE "Appointment_id_seq" RESTART WITH 1;
ALTER SEQUENCE "AppointmentService_id_seq" RESTART WITH 1;
ALTER SEQUENCE "Transaction_id_seq" RESTART WITH 1;
ALTER SEQUENCE "FinancialCategory_id_seq" RESTART WITH 1;
ALTER SEQUENCE "FinancialEntry_id_seq" RESTART WITH 1;
ALTER SEQUENCE "BankAccount_id_seq" RESTART WITH 1;
ALTER SEQUENCE "Salary_id_seq" RESTART WITH 1;
ALTER SEQUENCE "TipTransaction_id_seq" RESTART WITH 1;
ALTER SEQUENCE "BarberWithdrawalRequest_id_seq" RESTART WITH 1;
ALTER SEQUENCE "Setting_id_seq" RESTART WITH 1;
ALTER SEQUENCE "Permission_id_seq" RESTART WITH 1;
ALTER SEQUENCE "SmsLog_id_seq" RESTART WITH 1;
ALTER SEQUENCE "SmsSettings_id_seq" RESTART WITH 1;
ALTER SEQUENCE "SmsTemplate_id_seq" RESTART WITH 1;

-- Copy data from mova to zapas
-- Note: You need to run this from the mova database connection

-- Copy Users
INSERT INTO "User" (email, password, "firstName", "lastName", "phoneNumber", role, "isActive", "createdAt", "updatedAt")
SELECT email, password, "firstName", "lastName", "phoneNumber", role, "isActive", "createdAt", "updatedAt"
FROM dblink('host=localhost port=5433 dbname=mova user=postgres password=Lord7know$',
  'SELECT email, password, "firstName", "lastName", "phoneNumber", role, "isActive", "createdAt", "updatedAt" FROM "User"')
AS t(email text, password text, "firstName" text, "lastName" text, "phoneNumber" text, role text, "isActive" boolean, "createdAt" timestamp, "updatedAt" timestamp);

-- Copy Services
INSERT INTO "Service" (name, description, price, duration, "isActive", "createdAt", "updatedAt")
SELECT name, description, price, duration, "isActive", "createdAt", "updatedAt"
FROM dblink('host=localhost port=5433 dbname=mova user=postgres password=Lord7know$',
  'SELECT name, description, price, duration, "isActive", "createdAt", "updatedAt" FROM "Service"')
AS t(name text, description text, price integer, duration integer, "isActive" boolean, "createdAt" timestamp, "updatedAt" timestamp);

-- Copy Financial Categories
INSERT INTO "FinancialCategory" (name, description, type, "createdAt", "updatedAt")
SELECT name, description, type, "createdAt", "updatedAt"
FROM dblink('host=localhost port=5433 dbname=mova user=postgres password=Lord7know$',
  'SELECT name, description, type, "createdAt", "updatedAt" FROM "FinancialCategory"')
AS t(name text, description text, type text, "createdAt" timestamp, "updatedAt" timestamp);

-- Copy Bank Accounts
INSERT INTO "BankAccount" (name, "cardNumber", "createdAt", "updatedAt")
SELECT name, "cardNumber", "createdAt", "updatedAt"
FROM dblink('host=localhost port=5433 dbname=mova user=postgres password=Lord7know$',
  'SELECT name, "cardNumber", "createdAt", "updatedAt" FROM "BankAccount"')
AS t(name text, "cardNumber" text, "createdAt" timestamp, "updatedAt" timestamp);

-- Copy Barbers
INSERT INTO "Barber" (email, "firstName", "lastName", "phoneNumber", bio, avatar, "isActive", type, "salaryPercentage", "createdAt", "updatedAt")
SELECT email, "firstName", "lastName", "phoneNumber", bio, avatar, "isActive", type, "salaryPercentage", "createdAt", "updatedAt"
FROM dblink('host=localhost port=5433 dbname=mova user=postgres password=Lord7know$',
  'SELECT email, "firstName", "lastName", "phoneNumber", bio, avatar, "isActive", type, "salaryPercentage", "createdAt", "updatedAt" FROM "Barber"')
AS t(email text, "firstName" text, "lastName" text, "phoneNumber" text, bio text, avatar text, "isActive" boolean, type text, "salaryPercentage" integer, "createdAt" timestamp, "updatedAt" timestamp);

-- Copy Customers
INSERT INTO "Customer" ("firstName", "lastName", "phoneNumber", email, "barberId", "createdAt", "updatedAt")
SELECT "firstName", "lastName", "phoneNumber", email, "barberId", "createdAt", "updatedAt"
FROM dblink('host=localhost port=5433 dbname=mova user=postgres password=Lord7know$',
  'SELECT "firstName", "lastName", "phoneNumber", email, "barberId", "createdAt", "updatedAt" FROM "Customer"')
AS t("firstName" text, "lastName" text, "phoneNumber" text, email text, "barberId" integer, "createdAt" timestamp, "updatedAt" timestamp);

-- Copy Appointments
INSERT INTO "Appointment" (date, time, status, "totalAmount", "tipAmount", "barberId", "customerId", "createdAt", "updatedAt")
SELECT date, time, status, "totalAmount", "tipAmount", "barberId", "customerId", "createdAt", "updatedAt"
FROM dblink('host=localhost port=5433 dbname=mova user=postgres password=Lord7know$',
  'SELECT date, time, status, "totalAmount", "tipAmount", "barberId", "customerId", "createdAt", "updatedAt" FROM "Appointment"')
AS t(date date, time time, status text, "totalAmount" integer, "tipAmount" integer, "barberId" integer, "customerId" integer, "createdAt" timestamp, "updatedAt" timestamp);

-- Copy other tables as needed... 