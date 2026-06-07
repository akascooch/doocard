const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testPermissionsAPI() {
  try {
    console.log('🧪 شروع تست API دسترسی‌ها...\n');

    // تست دریافت صفحات موجود
    console.log('1. تست دریافت صفحات موجود:');
    const pagesResponse = await axios.get(`${BASE_URL}/permissions/pages`);
    console.log('✅ صفحات:', pagesResponse.data);
    console.log('');

    // تست دریافت قابلیت‌های موجود
    console.log('2. تست دریافت قابلیت‌های موجود:');
    const featuresResponse = await axios.get(`${BASE_URL}/permissions/features`);
    console.log('✅ قابلیت‌ها:', featuresResponse.data);
    console.log('');

    // تست دریافت دسترسی‌های نقش ADMIN
    console.log('3. تست دریافت دسترسی‌های نقش ADMIN:');
    const adminPermissionsResponse = await axios.get(`${BASE_URL}/permissions?role=ADMIN`);
    console.log('✅ تعداد دسترسی‌های ADMIN:', adminPermissionsResponse.data.length);
    console.log('نمونه دسترسی:', adminPermissionsResponse.data[0]);
    console.log('');

    // تست دریافت دسترسی‌های نقش BARBER
    console.log('4. تست دریافت دسترسی‌های نقش BARBER:');
    const barberPermissionsResponse = await axios.get(`${BASE_URL}/permissions?role=BARBER`);
    console.log('✅ تعداد دسترسی‌های BARBER:', barberPermissionsResponse.data.length);
    console.log('نمونه دسترسی:', barberPermissionsResponse.data[0]);
    console.log('');

    // تست دریافت دسترسی‌های نقش CUSTOMER
    console.log('5. تست دریافت دسترسی‌های نقش CUSTOMER:');
    const customerPermissionsResponse = await axios.get(`${BASE_URL}/permissions?role=CUSTOMER`);
    console.log('✅ تعداد دسترسی‌های CUSTOMER:', customerPermissionsResponse.data.length);
    console.log('نمونه دسترسی:', customerPermissionsResponse.data[0]);
    console.log('');

    // تست بازگردانی دسترسی‌های پیش‌فرض برای ADMIN
    console.log('6. تست بازگردانی دسترسی‌های پیش‌فرض برای ADMIN:');
    const resetResponse = await axios.post(`${BASE_URL}/permissions/reset/ADMIN`);
    console.log('✅ نتیجه بازگردانی:', resetResponse.data);
    console.log('');

    console.log('🎉 تمام تست‌ها با موفقیت انجام شد!');

  } catch (error) {
    console.error('❌ خطا در تست API:', error.response?.data || error.message);
  }
}

testPermissionsAPI(); 