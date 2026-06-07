const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testSimpleUsers() {
  try {
    console.log('🧪 تست ساده API کاربران...\n');

    // تست 1: دریافت کاربران بدون authentication
    console.log('1. تست دریافت کاربران:');
    try {
      const response = await axios.get(`${BASE_URL}/users`);
      console.log('✅ تعداد کاربران:', response.data.length);
      if (response.data.length > 0) {
        console.log('نمونه کاربر:', response.data[0]);
      }
    } catch (error) {
      console.log('❌ خطا:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('❌ خطا در تست:', error.response?.data || error.message);
  }
}

testSimpleUsers(); 