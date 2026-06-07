const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001';

async function testAccountingAPI() {
  console.log('🧪 تست API حسابداری...\n');

  try {
    // تست آمار کلی
    console.log('📊 تست آمار کلی...');
    const statsResponse = await axios.get(`${API_BASE_URL}/accounting/stats`);
    console.log('✅ آمار کلی:', statsResponse.data);

    // تست داده‌های نمودار
    console.log('\n📈 تست داده‌های نمودار...');
    const chartResponse = await axios.get(`${API_BASE_URL}/accounting/chart-data`);
    console.log('✅ داده‌های نمودار:', chartResponse.data);

    // تست حساب‌های بانکی
    console.log('\n🏦 تست حساب‌های بانکی...');
    const bankResponse = await axios.get(`${API_BASE_URL}/accounting/bank-accounts`);
    console.log('✅ حساب‌های بانکی:', bankResponse.data);

  } catch (error) {
    console.error('❌ خطا در تست API:', error.response?.data || error.message);
  }
}

testAccountingAPI(); 