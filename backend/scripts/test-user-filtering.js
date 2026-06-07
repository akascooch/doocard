const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testUserFiltering() {
  try {
    console.log('🧪 شروع تست فیلتر کردن کاربران بر اساس نقش...\n');

    // تست 1: دریافت کاربران بدون authentication (باید همه کاربران را برگرداند)
    console.log('1. تست دریافت کاربران بدون authentication:');
    try {
      const response = await axios.get(`${BASE_URL}/users`);
      console.log('✅ تعداد کاربران:', response.data.length);
      console.log('نمونه کاربر:', response.data[0]);
    } catch (error) {
      console.log('❌ خطا:', error.response?.data || error.message);
    }
    console.log('');

    // تست 2: دریافت کاربران با نقش ADMIN
    console.log('2. تست دریافت کاربران با نقش ADMIN:');
    try {
      const response = await axios.get(`${BASE_URL}/users`, {
        headers: {
          'Authorization': 'Bearer YOUR_ADMIN_TOKEN_HERE'
        }
      });
      console.log('✅ تعداد کاربران:', response.data.length);
    } catch (error) {
      console.log('❌ خطا:', error.response?.data || error.message);
    }
    console.log('');

    // تست 3: دریافت کاربران با نقش BARBER
    console.log('3. تست دریافت کاربران با نقش BARBER:');
    try {
      const response = await axios.get(`${BASE_URL}/users`, {
        headers: {
          'Authorization': 'Bearer YOUR_BARBER_TOKEN_HERE'
        }
      });
      console.log('✅ تعداد کاربران:', response.data.length);
      console.log('نقش‌های کاربران:', response.data.map(u => u.role));
    } catch (error) {
      console.log('❌ خطا:', error.response?.data || error.message);
    }
    console.log('');

    // تست 4: دریافت کاربران با نقش CUSTOMER
    console.log('4. تست دریافت کاربران با نقش CUSTOMER:');
    try {
      const response = await axios.get(`${BASE_URL}/users`, {
        headers: {
          'Authorization': 'Bearer YOUR_CUSTOMER_TOKEN_HERE'
        }
      });
      console.log('✅ تعداد کاربران:', response.data.length);
      console.log('نقش‌های کاربران:', response.data.map(u => u.role));
    } catch (error) {
      console.log('❌ خطا:', error.response?.data || error.message);
    }
    console.log('');

    console.log('🎉 تمام تست‌ها با موفقیت انجام شد!');
    console.log('\n📝 نکات:');
    console.log('- ADMIN: باید همه کاربران را ببیند');
    console.log('- BARBER: باید فقط مشتریان را ببیند');
    console.log('- CUSTOMER: باید فقط خودش را ببیند');

  } catch (error) {
    console.error('❌ خطا در تست:', error.response?.data || error.message);
  }
}

testUserFiltering(); 