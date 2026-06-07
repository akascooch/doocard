const jalaali = require('jalaali-js');

console.log('=== Testing Jalali Conversion ===');
console.log('');

// Test today's date
const today = new Date(2025, 9, 20); // October 20, 2025 (month is 0-indexed)
console.log('Input Date (Gregorian):');
console.log('  Full:', today.toString());
console.log('  Year:', today.getFullYear());
console.log('  Month:', today.getMonth() + 1, '(October)');
console.log('  Day:', today.getDate());
console.log('');

// Convert to Jalali
const jalaliResult = jalaali.toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
console.log('Converted to Jalali:');
console.log('  Year (jy):', jalaliResult.jy);
console.log('  Month (jm):', jalaliResult.jm);
console.log('  Day (jd):', jalaliResult.jd);
console.log('  Full:', `${jalaliResult.jy}/${jalaliResult.jm}/${jalaliResult.jd}`);
console.log('');

console.log('EXPECTED: 1404/07/28 (28 Mehr 1404)');
console.log('');

// Test multiple dates around today
console.log('=== Testing Multiple Dates ===');
const testDates = [
  { date: new Date(2025, 9, 19), label: '2025-10-19' },
  { date: new Date(2025, 9, 20), label: '2025-10-20 (TODAY)' },
  { date: new Date(2025, 9, 21), label: '2025-10-21' },
];

testDates.forEach(({ date, label }) => {
  const j = jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  console.log(`${label} → ${j.jy}/${j.jm}/${j.jd}`);
});
console.log('');

// Reverse test
console.log('=== Reverse Test (Jalali to Gregorian) ===');
const jalaliDates = [
  { jy: 1404, jm: 7, jd: 27, label: '1404/07/27' },
  { jy: 1404, jm: 7, jd: 28, label: '1404/07/28 (EXPECTED TODAY)' },
  { jy: 1404, jm: 7, jd: 29, label: '1404/07/29' },
];

jalaliDates.forEach(({ jy, jm, jd, label }) => {
  const g = jalaali.toGregorian(jy, jm, jd);
  console.log(`${label} → ${g.gy}-${g.gm}-${g.gd}`);
});

