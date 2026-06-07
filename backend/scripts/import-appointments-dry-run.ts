#!/usr/bin/env ts-node
/**
 * Dry run - test import logic with first 10 rows only
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

const prisma = new PrismaClient();
const EXCEL_FILE_PATH = 'C:\\Users\\a.hosseini\\Desktop\\Data\\Appointments.xls';
const MAX_TEST_ROWS = 10;

/**
 * Simple Jalali to Gregorian (approximate)
 */
function jalaliToGregorian(jalaliStr: string): Date | null {
  try {
    const parts = jalaliStr.split(/[\/\-]/);
    if (parts.length !== 3) return null;

    const jy = parseInt(parts[0]);
    const jm = parseInt(parts[1]);
    const jd = parseInt(parts[2]);

    // Simple approximation: 1404 → 2025
    const gy = jy + 621;
    const date = new Date(gy, jm - 1, jd, 12, 0, 0);
    
    return date;
  } catch {
    return null;
  }
}

async function dryRun() {
  console.log('\n🧪 DRY RUN - Testing with first', MAX_TEST_ROWS, 'rows\n');

  try {
    // Read Excel
    const fileBuffer = fs.readFileSync(EXCEL_FILE_PATH);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', codepage: 65001 });
    const jsonData: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });

    console.log(`✅ Loaded ${jsonData.length - 1} rows\n`);

    let processed = 0;
    let success = 0;
    let skipped = 0;

    for (let i = 1; i < Math.min(MAX_TEST_ROWS + 1, jsonData.length); i++) {
      const row = jsonData[i];
      processed++;

      console.log(`\n--- Row ${i} ---`);
      console.log('Date:', row[0]);
      console.log('Customer Mobile:', row[1]);
      console.log('Employee Mobile:', row[2]);
      console.log('Price:', row[3]);
      console.log('Service Name:', row[4]);
      console.log('Service ID:', row[5]);

      // Parse
      const date = row[0]?.toString() || '';
      const customerMobile = row[1]?.toString().replace(/\s/g, '') || '';
      const employeeMobile = row[2]?.toString().replace(/\s/g, '') || '';
      let priceStr = row[3]?.toString() || '0';
      priceStr = priceStr.replace(/,/g, '');
      const price = parseFloat(priceStr);
      const serviceId = parseInt(row[5]?.toString() || '0');

      // Validate
      if (!date || !customerMobile || !employeeMobile) {
        console.log('⚠️  Skipped - missing data');
        skipped++;
        continue;
      }

      // Convert date
      const gregorianDate = jalaliToGregorian(date);
      if (!gregorianDate) {
        console.log('⚠️  Skipped - invalid date');
        skipped++;
        continue;
      }
      console.log('Converted date:', gregorianDate.toISOString());

      // Find customer
      const customer = await prisma.customer.findFirst({
        where: { user: { phone: customerMobile } },
        include: { user: true },
      });

      if (!customer) {
        console.log(`⚠️  Skipped - customer not found (${customerMobile})`);
        skipped++;
        continue;
      }
      console.log(`✅ Customer: ${customer.user.name}`);

      // Find employee
      const employee = await prisma.employee.findFirst({
        where: { user: { phone: employeeMobile } },
        include: { user: true },
      });

      if (!employee) {
        console.log(`⚠️  Skipped - employee not found (${employeeMobile})`);
        skipped++;
        continue;
      }
      console.log(`✅ Employee: ${employee.user.name}`);

      // Find service
      const service = await prisma.service.findUnique({
        where: { id: serviceId },
      });

      if (!service) {
        console.log(`⚠️  Skipped - service not found (ID: ${serviceId})`);
        skipped++;
        continue;
      }
      console.log(`✅ Service: ${service.name}`);

      // Normalize price (divide by 10)
      const normalizedPrice = Math.round(price / 10);
      console.log(`💰 Price: ${price} → ${normalizedPrice} Rials`);

      console.log('✅ This row would be imported!');
      success++;
    }

    console.log('\n' + '='.repeat(60));
    console.log('🧪 DRY RUN Summary:\n');
    console.log(`Processed: ${processed}`);
    console.log(`✅ Would import: ${success}`);
    console.log(`⚠️  Would skip: ${skipped}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

dryRun();

