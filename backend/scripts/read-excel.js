const XLSX = require('xlsx');
const path = require('path');

const filePath = 'C:\\Users\\a.hosseini\\Desktop\\Data\\DATA1-7.xlsx';

console.log('📁 Reading Excel file:', filePath, '\n');

try {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  console.log('📊 Sheet Name:', sheetName);
  console.log('📋 Columns:', XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0]);
  console.log('\n📝 Sample Data (First 5 rows):\n');
  
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  data.slice(0, 6).forEach((row, index) => {
    console.log(`Row ${index}:`, row);
  });
  
  console.log('\n📊 Total Rows:', data.length - 1, '(excluding header)');
  
  // Parse as objects
  const records = XLSX.utils.sheet_to_json(worksheet);
  console.log('\n🔍 First Record (as object):\n', records[0]);
  
} catch (error) {
  console.error('❌ Error:', error.message);
}

