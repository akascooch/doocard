const axios = require('axios');

async function testAPIEndpoint() {
  try {
    console.log('🌐 Testing API endpoint...\n');

    // تنظیمات API
    const baseURL = 'http://localhost:3000'; // یا آدرس سرور
    const token = 'YOUR_JWT_TOKEN'; // توکن ادمین

    // تست endpoint بدون فیلتر تاریخ
    console.log('📊 Testing /accounting/stats without date filter:');
    try {
      const response1 = await axios.get(`${baseURL}/accounting/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('✅ Response:', response1.data);
    } catch (error) {
      console.log('❌ Error:', error.response?.data || error.message);
    }

    // تست endpoint با فیلتر تاریخ (6 ماه گذشته)
    console.log('\n📅 Testing /accounting/stats with date filter:');
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const fromDate = sixMonthsAgo.toISOString().split('T')[0];
    const toDate = new Date().toISOString().split('T')[0];

    try {
      const response2 = await axios.get(`${baseURL}/accounting/stats?from=${fromDate}&to=${toDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('✅ Response with date filter:', response2.data);
    } catch (error) {
      console.log('❌ Error with date filter:', error.response?.data || error.message);
    }

    // تست endpoint نمودار
    console.log('\n📈 Testing /accounting/chart:');
    try {
      const response3 = await axios.get(`${baseURL}/accounting/chart?months=6`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('✅ Chart response:', response3.data);
    } catch (error) {
      console.log('❌ Chart error:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('❌ General error:', error.message);
  }
}

// اگر توکن در دسترس نیست، پیام راهنما نمایش بده
if (process.argv[2]) {
  // استفاده از توکن از command line
  process.env.JWT_TOKEN = process.argv[2];
  testAPIEndpoint();
} else {
  console.log('🔑 Usage: node test-api-endpoint.js <JWT_TOKEN>');
  console.log('🔑 Or set JWT_TOKEN environment variable');
  console.log('🔑 Example: node test-api-endpoint.js eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
}
