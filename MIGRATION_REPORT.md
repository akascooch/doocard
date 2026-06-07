# STRICT DATA MIGRATION PREPARATION – FULL SNAPSHOT + EXCEL PARSE

**Read-only analysis. No DB writes. No schema changes.**

---

## 1. DB Snapshot

**Source:** LOCAL database (PostgreSQL, `localhost:5433`, database `MOVA`).  
**For production:** On the server run (e.g. `ssh root@185.255.88.158 -p 3031` then from backend dir with correct `DATABASE_URL`):

```bash
cd /var/www/doocard/backend && node -e "
const { Client } = require('pg');
require('dotenv').config();
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(() => Promise.all([
  c.query('SELECT e.id, u.name, e.\"isActive\" FROM employees e JOIN users u ON u.id = e.\"userId\"'),
  c.query('SELECT id, name, \"durationMinutes\" FROM services'),
  c.query('SELECT c.id, u.phone FROM customers c JOIN users u ON u.id = c.\"userId\"'),
  c.query('SELECT MIN(\"scheduledAt\"), MAX(\"scheduledAt\") FROM appointments')
])).then(([e,s,cu,a]) => { console.log(JSON.stringify({employees:e.rows,services:s.rows,customers:cu.rows,range:a.rows[0]},null,2)); return c.end(); });
"
```

Or run the 4 queries from `backend/scripts/db-snapshot.sql` with `psql`.

### 1️⃣ Employees + names

| id | name | isActive |
|----|------|----------|
| 2 | آریو سعیدی | true |
| 3 | مجید محبوب | true |
| 12 | محمد معینی | true |
| 11 | تامی نبی زاده | true |
| 8 | آرش بهمن | true |
| 5 | اشکان اشتیش | true |
| 4 | علی ثابتی | true |
| 1 | تیم دوکارد (آقا میلاد) | true |

### 2️⃣ Services

| id | name | durationMinutes |
|----|------|-----------------|
| 4 | خدمات ناخن | 60 |
| 2 | اصلاح کامل | 60 |
| 3 | اصلاح ریش | 60 |
| 9 | مراقبت و پاکسازی تخصصی پوست صورت | 60 |
| 8 | استایل مو | 60 |
| 7 | رنگ مو | 60 |
| 6 | احیا مو | 60 |
| 5 | خدمات داماد | 60 |

### 3️⃣ Customers + phone

(35 rows – full list in `backend/scripts/migration-report-output.json`. Sample: id 1–35 with phones 09304013878, 09124301530, …)

### 4️⃣ Appointment historical range

| MIN(scheduledAt) | MAX(scheduledAt) |
|------------------|------------------|
| null | null |

*(Local DB has no appointments; production may have non-null range.)*

---

## 2. Excel 1403 structure

- **File:** 1403.xlsx  
- **Sheet names:** Sheet1  
- **Column headers (row 2):** تاریخ، موبایل، مشتری، دریافت، درصد، کارمند، تخفیف، تعداد، قیمت، نام، فاکتور  
- **First 10 rows (sample):**

| تاریخ | موبایل | مشتری | کارمند | نام (خدمت) | فاکتور |
|-------|--------|--------|--------|------------|--------|
| 1403/01/02 | | | میلاد اسدپور | اصلاح | 12094 |
| 1403/01/02 | | | رضا | اصلاح | 12093 |
| 1403/01/02 | | | میلاد اسدپور | اصلاح | 12092 |
| 1403/01/02 | | | رضا | اصلاح | 12091 |
| 1403/01/02 | | | مهدی | فشیال | 12090 |
| 1403/01/02 | | | مهدی | فشیال | 12089 |
| 1403/01/02 | | | رضا | اصلاح | 12088 |
| 1403/01/02 | | | میلاد اسدپور | اصلاح | 12087 |
| 1403/01/02 | | | آریو | اصلاح | 12086 |

- **Distinct employee names:** آرش، آریو، اشکان، تامی، جانی، رضا، شهرام، علی، مجید، محمد، مهدی، میلاد اسدپور  
- **Distinct service names:** اصلاح، بوتاکس، تیپ، ج، داماد، رنگ مو، ریش، فشیال، مانیکور، پدیکور  
- **Distinct customer identifiers:** Mostly invoice IDs (12075–19520 etc.); موبایل/مشتری often empty  
- **Date format:** Jalali YYYY/MM/DD (e.g. 1403/01/02)  
- **Time format:** N/A (no time column)  
- **Total data rows:** 8,495  

---

## 3. Excel 1404 structure

- **File:** 1404.xlsx  
- **Sheet names:** Sheet1  
- **Column headers:** Same as 1403 (تاریخ، موبایل، مشتری، دریافت، درصد، کارمند، تخفیف، تعداد، قیمت، نام، فاکتور)  
- **First 10 rows (sample):** 1404/11/24 with employees علی، محمد، آرش؛ services اصلاح، پدیکور؛ invoice IDs 26816, 26815, …  
- **Distinct employee names:** آرش، آریو، اشکان، تامی، رضا، علی، مجید، محمد، میلاد اسدپور  
- **Distinct service names:** اصلاح، بوتاکس، تیپ، ج، ریش، پدیکور  
- **Distinct customer identifiers:** Mostly invoice IDs (20599–26816 etc.)  
- **Date format:** Jalali YYYY/MM/DD (e.g. 1404/11/24)  
- **Time format:** N/A (no time column)  
- **Total data rows:** 6,219  

---

## 4. Employee mapping (Excel vs DB)

| Status | Excel | DB / Note |
|--------|--------|-----------|
| **Fuzzy match candidate** | آرش | آرش بهمن |
| **Fuzzy match candidate** | آریو | آریو سعیدی |
| **Fuzzy match candidate** | اشکان | اشکان اشتیش |
| **Fuzzy match candidate** | تامی | تامی نبی زاده |
| **Fuzzy match candidate** | علی | علی ثابتی |
| **Fuzzy match candidate** | مجید | مجید محبوب |
| **Fuzzy match candidate** | محمد | محمد معینی |
| **Missing in DB** | جانی | — |
| **Missing in DB** | رضا | — |
| **Missing in DB** | شهرام | — |
| **Missing in DB** | مهدی | — |
| **Missing in DB** | میلاد اسدپور | — (DB has "تیم دوکارد (آقا میلاد)") |

*Exact match:* none (Excel uses short/first names; DB has full names).

---

## 5. Service mapping (Excel vs DB)

| Status | Excel | DB / Note |
|--------|--------|-----------|
| **Exact match** | رنگ مو | رنگ مو |
| **Fuzzy match candidate** | اصلاح | اصلاح کامل |
| **Fuzzy match candidate** | داماد | خدمات داماد |
| **Fuzzy match candidate** | ریش | اصلاح ریش |
| **Missing in DB** | بوتاکس | — |
| **Missing in DB** | تیپ | — |
| **Missing in DB** | ج | — |
| **Missing in DB** | فشیال | — |
| **Missing in DB** | مانیکور | — |
| **Missing in DB** | پدیکور | — |

---

## 6. Customer mapping (Excel vs DB)

- **Exact match:** none (Excel customer identifiers are mostly invoice IDs, not phone numbers).  
- **Fuzzy match candidates:** Some Excel numeric IDs partially match DB phones (e.g. 12101 vs 09121013686). Many such pairs in `migration-report-output.json` under `customerMapping.fuzzy`.  
- **Missing in DB:** Most Excel rows have empty موبایل/مشتری; customer is effectively identified by invoice ID. For import, customer resolution (phone vs invoice ID) must be defined before any write.

*(Full lists in `backend/scripts/migration-report-output.json`.)*

---

## 7. Duplicate risk analysis

- **Group by:** customer_identifier + date + employee (no time column in Excel).  
- **Total distinct groups:** 14,713  
- **Duplicate groups:** 1  
- **Rows in duplicate groups:** 2  
- **Conclusion:** Duplicate risk is very low; one group has 2 rows. Recommend resolving that group before import (e.g. treat as one appointment or define rule).

---

## 8. DO NOT IMPORT

---

## 9. DO NOT DEPLOY

---

*Generated by read-only migration preparation. No data was imported; no schema or production deployment was performed.*
