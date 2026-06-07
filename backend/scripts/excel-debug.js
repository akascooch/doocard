const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const filePath = path.join(path.resolve(__dirname, '..', '..'), '1403.xlsx');
console.log('File size:', fs.statSync(filePath).size);
const workbook = new ExcelJS.Workbook();
workbook.xlsx.readFile(filePath).then(() => {
  console.log('Workbook keys:', Object.keys(workbook));
  console.log('worksheets length:', workbook.worksheets ? workbook.worksheets.length : 'no worksheets');
  console.log('_worksheets:', workbook._worksheets ? Array.from(workbook._worksheets.entries ? workbook._worksheets.entries() : Object.entries(workbook._worksheets)) : 'none');
  if (workbook.worksheets && workbook.worksheets.length) {
    workbook.worksheets.forEach((ws, i) => console.log('Sheet', i, ws.name));
  }
  let count = 0;
  workbook.eachSheet((ws, id) => { count++; console.log('eachSheet', id, ws.name); });
  console.log('eachSheet count:', count);
}).catch(e => console.error(e));
