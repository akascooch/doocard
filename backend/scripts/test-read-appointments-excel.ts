#!/usr/bin/env ts-node
/**
 * Test reading Appointments Excel file
 * Shows first 5 rows to verify structure
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';

const EXCEL_FILE_PATH = 'C:\\Users\\a.hosseini\\Desktop\\Data\\Appointments.xls';

function testReadExcel() {
  console.log('\n📖 Testing Excel file read:\n');
  console.log('File:', EXCEL_FILE_PATH);

  try {
    // Read file using xlsx library (supports both .xls and .xlsx)
    const fileBuffer = fs.readFileSync(EXCEL_FILE_PATH);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', codepage: 65001 }); // UTF-8
    
    console.log('\n✅ File loaded successfully');
    console.log(`📊 Sheets: ${workbook.SheetNames.length}`);
    console.log(`📄 Sheet names: ${workbook.SheetNames.join(', ')}\n`);
    
    if (workbook.SheetNames.length === 0) {
      console.error('❌ No worksheets found in the file!');
      process.exit(1);
    }
    
    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    console.log('='.repeat(80));
    console.log(`First 6 rows from sheet "${sheetName}":\n`);
    
    for (let i = 0; i < Math.min(6, jsonData.length); i++) {
      console.log(`Row ${i + 1}:`, jsonData[i]);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Total rows: ${jsonData.length}`);
    console.log('✅ Test complete - ready for import!');
    console.log('\nExpected columns:');
    console.log('1. تاریخ (Persian date)');
    console.log('2. موبایل (Customer mobile)');
    console.log('3. شماره موبایل کارمند (Employee mobile)');
    console.log('4. قیمت (Price in Tomans)');
    console.log('5. نام (Service name)');
    console.log('6. آیدی خدمات (Service ID)');

  } catch (error) {
    console.error('\n❌ Error reading Excel file:', error);
    console.error('\nPlease check:');
    console.error('1. File exists at:', EXCEL_FILE_PATH);
    console.error('2. File is not open in Excel');
    process.exit(1);
  }
}

testReadExcel();

