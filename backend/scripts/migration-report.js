/**
 * STRICT DATA MIGRATION PREPARATION – READ-ONLY.
 * 1) DB snapshot (set DATABASE_URL for target DB)
 * 2) Parse 1403.xlsx & 1404.xlsx
 * 3) Mapping tables (employees, services, customers)
 * 4) Duplicate risk
 * Output: stdout (DB + JSON) and scripts/migration-report-output.json
 */
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { Client } = require('pg');

const projectRoot = path.resolve(__dirname, '..', '..');
const excelFiles = ['1403.xlsx', '1404.xlsx'].map((f) => path.join(projectRoot, f));

// Excel column indices (row 1 = header): تاریخ=0, موبایل=1, مشتری=2, دریافت=3, درصد=4, کارمند=5, تخفیف=6, تعداد=7, قیمت=8, نام=9, فاکتور=10
const COL = { date: 0, mobile: 1, customerName: 2, received: 3, percent: 4, employee: 5, discount: 6, count: 7, price: 8, serviceName: 9, invoiceId: 10 };

function getCell(ws, r, c) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  if (!cell) return '';
  let v = cell.v;
  if (v instanceof Date) v = v.toISOString();
  return (v != null ? String(v) : '').trim();
}

function parseExcel(filePath) {
  const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: true });
  const out = { file: path.basename(filePath), sheetNames: workbook.SheetNames, sheets: [], distinctEmployees: new Set(), distinctServices: new Set(), distinctCustomerIds: new Set(), dateSamples: [], timeSamples: [], rows: [] };
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const ref = ws['!ref'];
    if (!ref) continue;
    const range = XLSX.utils.decode_range(ref);
    const headerRow = 1;
    const headers = [];
    for (let c = range.s.c; c <= range.e.c; c++) headers.push(getCell(ws, headerRow, c));
    const dataRows = [];
    for (let r = headerRow + 1; r <= range.e.r; r++) {
      const row = {
        date: getCell(ws, r, COL.date),
        mobile: getCell(ws, r, COL.mobile),
        customerName: getCell(ws, r, COL.customerName),
        employee: getCell(ws, r, COL.employee),
        serviceName: getCell(ws, r, COL.serviceName),
        invoiceId: getCell(ws, r, COL.invoiceId),
      };
      dataRows.push(row);
      if (row.employee && row.employee !== 'کارمند') out.distinctEmployees.add(row.employee);
      if (row.serviceName && row.serviceName !== 'نام') out.distinctServices.add(row.serviceName);
      const custId = row.mobile || row.customerName || row.invoiceId;
      if (custId) out.distinctCustomerIds.add(custId);
      if (row.date) out.dateSamples.push(row.date);
    }
    out.sheets.push({ name: sheetName, headers, first10: dataRows.slice(0, 10), totalDataRows: dataRows.length });
    out.rows = out.rows.concat(dataRows);
  }
  out.distinctEmployees = Array.from(out.distinctEmployees).sort();
  out.distinctServices = Array.from(out.distinctServices).sort();
  out.distinctCustomerIds = Array.from(out.distinctCustomerIds).sort();
  out.dateSamples = [...new Set(out.dateSamples)].slice(0, 5);
  return out;
}

function buildMapping(excelList, dbList, keyFn) {
  const dbSet = new Set(dbList.map(keyFn));
  const exact = [];
  const fuzzy = [];
  const missing = [];
  for (const x of excelList) {
    const k = (typeof keyFn === 'function' ? keyFn(x) : x).trim().toLowerCase();
    if (dbSet.has(k)) exact.push(x);
    else {
      const normalized = (typeof x === 'string' ? x : keyFn(x)).trim();
      const match = dbList.find((d) => String(d).trim().toLowerCase() === normalized.toLowerCase());
      if (match) fuzzy.push({ excel: x, db: match });
      else missing.push(x);
    }
  }
  return { exact, fuzzy, missing };
}

function simpleFuzzy(dbList, excelList) {
  const result = { exact: [], fuzzy: [], missing: [] };
  const dbLower = new Map(dbList.map((d) => [String(d).trim().toLowerCase(), d]));
  for (const x of excelList) {
    const xStr = String(x).trim();
    const k = xStr.toLowerCase();
    if (dbLower.has(k)) result.exact.push(xStr);
    else {
      const found = dbList.find((d) => String(d).trim().toLowerCase().includes(k) || k.includes(String(d).trim().toLowerCase()));
      if (found) result.fuzzy.push({ excel: xStr, db: found });
      else result.missing.push(xStr);
    }
  }
  return result;
}

async function runDbSnapshot(client) {
  const q1 = await client.query('SELECT e.id, u.name, e."isActive" FROM employees e JOIN users u ON u.id = e."userId"');
  const q2 = await client.query('SELECT id, name, "durationMinutes" FROM services');
  const q3 = await client.query('SELECT c.id, u.phone FROM customers c JOIN users u ON u.id = c."userId"');
  const q4 = await client.query('SELECT MIN("scheduledAt") as min_at, MAX("scheduledAt") as max_at FROM appointments');
  return { employees: q1.rows, services: q2.rows, customers: q3.rows, appointmentRange: q4.rows[0] };
}

async function main() {
  const report = { dbSnapshot: null, excel1403: null, excel1404: null, employeeMapping: null, serviceMapping: null, customerMapping: null, duplicateRisk: null };
  {
    const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:Lord7know$@localhost:5433/MOVA';
    const client = new Client({ connectionString: dbUrl });
    try {
      await client.connect();
      report.dbSnapshot = await runDbSnapshot(client);
      console.log('=== DB SNAPSHOT (full) ===');
      console.log('1. Employees:', JSON.stringify(report.dbSnapshot.employees, null, 2));
      console.log('2. Services:', JSON.stringify(report.dbSnapshot.services, null, 2));
      console.log('3. Customers:', JSON.stringify(report.dbSnapshot.customers, null, 2));
      console.log('4. Appointment range:', JSON.stringify(report.dbSnapshot.appointmentRange, null, 2));
    } catch (e) {
      console.error('DB error (run on server or set DATABASE_URL):', e.message);
      report.dbSnapshot = { error: e.message };
    } finally {
      await client.end();
    }

    const p1403 = parseExcel(excelFiles[0]);
    const p1404 = parseExcel(excelFiles[1]);
    report.excel1403 = { sheetNames: p1403.sheetNames, headers: p1403.sheets[0]?.headers, first10: p1403.sheets[0]?.first10, distinctEmployees: p1403.distinctEmployees, distinctServices: p1403.distinctServices, distinctCustomerIds: p1403.distinctCustomerIds, dateFormat: 'Jalali YYYY/MM/DD', timeFormat: 'N/A (no time column)', totalRows: p1403.rows.length };
    report.excel1404 = { sheetNames: p1404.sheetNames, headers: p1404.sheets[0]?.headers, first10: p1404.sheets[0]?.first10, distinctEmployees: p1404.distinctEmployees, distinctServices: p1404.distinctServices, distinctCustomerIds: p1404.distinctCustomerIds, dateFormat: 'Jalali YYYY/MM/DD', timeFormat: 'N/A (no time column)', totalRows: p1404.rows.length };

    const allEmployees = [...new Set([...p1403.distinctEmployees, ...p1404.distinctEmployees])];
    const allServices = [...new Set([...p1403.distinctServices, ...p1404.distinctServices])];
    const allCustomers = [...new Set([...p1403.distinctCustomerIds, ...p1404.distinctCustomerIds])];

    if (report.dbSnapshot.employees) {
      const dbNames = report.dbSnapshot.employees.map((r) => r.name);
      report.employeeMapping = simpleFuzzy(dbNames, allEmployees);
    }
    if (report.dbSnapshot.services) {
      const dbNames = report.dbSnapshot.services.map((r) => r.name);
      report.serviceMapping = simpleFuzzy(dbNames, allServices);
    }
    if (report.dbSnapshot.customers) {
      const dbPhones = report.dbSnapshot.customers.map((r) => r.phone);
      report.customerMapping = simpleFuzzy(dbPhones, allCustomers);
    }

    const allRows = [...p1403.rows, ...p1404.rows];
    const groupKey = (r) => [r.mobile || r.customerName || r.invoiceId, r.date, r.employee].join('|');
    const counts = {};
    allRows.forEach((r) => {
      const k = groupKey(r);
      counts[k] = (counts[k] || 0) + 1;
    });
    const duplicates = Object.entries(counts).filter(([, n]) => n > 1);
    report.duplicateRisk = { groupBy: 'customer_identifier + date + employee', totalGroups: Object.keys(counts).length, duplicateGroups: duplicates.length, duplicateRows: duplicates.reduce((s, [, n]) => s + n, 0), sampleDuplicates: duplicates.slice(0, 20) };

    const outPath = path.join(__dirname, 'migration-report-output.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log('\nReport written to', outPath);
  }
}

main().catch(console.error);
