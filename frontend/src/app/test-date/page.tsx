'use client';

import { useEffect, useState } from 'react';
import { getCurrentJalaliDate, formatToJalali } from '@/lib/date';
import dayjs from 'dayjs';
import jalaliday from 'jalaliday';

dayjs.extend(jalaliday);

export default function TestDatePage() {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const testLogs: string[] = [];
    
    // Test 1: Native JavaScript Date
    const now = new Date();
    testLogs.push('=== JavaScript Native ===');
    testLogs.push(`Full Date: ${now.toString()}`);
    testLogs.push(`ISO String: ${now.toISOString()}`);
    testLogs.push(`getFullYear(): ${now.getFullYear()}`);
    testLogs.push(`getMonth(): ${now.getMonth()} (0-indexed)`);
    testLogs.push(`getDate(): ${now.getDate()}`);
    testLogs.push(`getDay(): ${now.getDay()} (0=Sunday)`);
    testLogs.push(`getHours(): ${now.getHours()}`);
    testLogs.push(`getTimezoneOffset(): ${now.getTimezoneOffset()} minutes`);
    testLogs.push('');

    // Test 2: Local Date Construction
    const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    testLogs.push('=== Local Date Construction ===');
    testLogs.push(`Local Date: ${localDate.toString()}`);
    testLogs.push(`Year: ${localDate.getFullYear()}`);
    testLogs.push(`Month: ${localDate.getMonth() + 1}`);
    testLogs.push(`Day: ${localDate.getDate()}`);
    testLogs.push('');

    // Test 3: dayjs
    testLogs.push('=== dayjs() ===');
    testLogs.push(`dayjs(): ${dayjs().format()}`);
    testLogs.push(`dayjs().format('YYYY-MM-DD'): ${dayjs().format('YYYY-MM-DD')}`);
    testLogs.push('');

    // Test 4: dayjs with local date
    testLogs.push('=== dayjs(localDate) ===');
    testLogs.push(`dayjs(localDate): ${dayjs(localDate).format()}`);
    testLogs.push(`dayjs(localDate).format('YYYY-MM-DD'): ${dayjs(localDate).format('YYYY-MM-DD')}`);
    testLogs.push('');

    // Test 5: Jalali conversion - OLD METHOD
    testLogs.push('=== Jalali - OLD METHOD (dayjs()) ===');
    try {
      const jalaliOld = dayjs().calendar('jalali').locale('fa').format('YYYY/MM/DD');
      testLogs.push(`OLD: ${jalaliOld}`);
    } catch (e: any) {
      testLogs.push(`OLD Error: ${e.message}`);
    }
    testLogs.push('');

    // Test 6: Jalali conversion - NEW METHOD
    testLogs.push('=== Jalali - NEW METHOD (localDate) ===');
    try {
      const jalaliNew = dayjs(localDate).calendar('jalali').locale('fa').format('YYYY/MM/DD');
      testLogs.push(`NEW: ${jalaliNew}`);
    } catch (e: any) {
      testLogs.push(`NEW Error: ${e.message}`);
    }
    testLogs.push('');

    // Test 7: getCurrentJalaliDate function
    testLogs.push('=== getCurrentJalaliDate() Function ===');
    try {
      const currentJalali = getCurrentJalaliDate();
      testLogs.push(`Result: ${currentJalali}`);
    } catch (e: any) {
      testLogs.push(`Error: ${e.message}`);
    }
    testLogs.push('');

    // Test 8: formatToJalali with different inputs
    testLogs.push('=== formatToJalali() Function ===');
    try {
      const formatted1 = formatToJalali(now);
      testLogs.push(`formatToJalali(now): ${formatted1}`);
      
      const formatted2 = formatToJalali(new Date());
      testLogs.push(`formatToJalali(new Date()): ${formatted2}`);
      
      const formatted3 = formatToJalali('2024-10-19');
      testLogs.push(`formatToJalali('2024-10-19'): ${formatted3}`);
    } catch (e: any) {
      testLogs.push(`Error: ${e.message}`);
    }
    testLogs.push('');

    // Test 9: Expected Result
    testLogs.push('=== EXPECTED RESULT ===');
    testLogs.push(`Today Gregorian: 2024-10-19 (October 19, 2024)`);
    testLogs.push(`Today Jalali: 1404/07/28 (28 Mehr 1404)`);
    testLogs.push(`NOT: 1404/07/29 (29 Mehr)`);
    testLogs.push('');

    // Test 10: Browser Info
    testLogs.push('=== Browser Info ===');
    testLogs.push(`User Agent: ${navigator.userAgent}`);
    testLogs.push(`Language: ${navigator.language}`);
    testLogs.push(`Platform: ${navigator.platform}`);
    
    setLogs(testLogs);

    // Console log for debugging
    console.log('📅 Date Test Results:');
    testLogs.forEach(log => console.log(log));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8" dir="ltr">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold mb-4 text-center">
            🧪 Date Testing Page
          </h1>
          
          <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
            <h2 className="font-bold text-xl mb-2">Expected Today:</h2>
            <p className="text-lg">Gregorian: <strong>2024-10-19</strong></p>
            <p className="text-lg">Jalali: <strong>1404/07/28</strong></p>
          </div>

          <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
            <h2 className="font-bold text-xl mb-2">Current Result:</h2>
            <p className="text-2xl font-bold text-red-600">
              {getCurrentJalaliDate()}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              If this shows 1404/07/29, the fix is not working!
            </p>
          </div>

          <div className="bg-gray-100 rounded-lg p-4 font-mono text-sm overflow-auto max-h-96">
            <h2 className="font-bold text-lg mb-3">Debug Logs:</h2>
            {logs.map((log, idx) => (
              <div 
                key={idx} 
                className={`
                  ${log.startsWith('===') ? 'font-bold text-blue-600 mt-2' : ''}
                  ${log.includes('Error') ? 'text-red-600' : ''}
                  ${log.includes('EXPECTED') ? 'text-green-600' : ''}
                `}
              >
                {log || <br />}
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-green-50 border-l-4 border-green-500 rounded">
            <h2 className="font-bold text-lg mb-2">Instructions:</h2>
            <ol className="list-decimal list-inside space-y-1">
              <li>Check the "Current Result" above</li>
              <li>Check all the debug logs</li>
              <li>Open DevTools Console (F12) for more details</li>
              <li>Compare with "Expected Today"</li>
              <li>If wrong, check timezone offset</li>
            </ol>
          </div>

          <div className="mt-6 flex gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              🔄 Reload Test
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                sessionStorage.clear();
                window.location.reload();
              }}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              🧹 Clear Storage & Reload
            </button>
            <a
              href="/dashboard/appointments"
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 inline-block"
            >
              📅 Go to Appointments
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

