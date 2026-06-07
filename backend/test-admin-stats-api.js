const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testAdminStatsAPI() {
  try {
    // ایجاد token برای user admin
    const token = jwt.sign(
      { id: 9, phone: '09370504588', role: 'ADMIN' },
      'your-super-secret-jwt-key-here-make-it-very-long-and-random',
      { expiresIn: '1h' }
    );

    console.log('\n🔐 Testing Admin Stats API...\n');

    const response = await axios.get('http://localhost:3001/api/dashboard/admin-stats', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ API Response:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  کل نوبت‌ها: ${response.data.totalAppointments}`);
    console.log(`  نوبت‌های امروز: ${response.data.todayAppointments}`);
    console.log(`  کل مشتریان: ${response.data.totalCustomers}`);
    console.log(`  کل کارکنان: ${response.data.totalEmployees}`);
    console.log(`  درآمد ماهانه: ${(response.data.monthlyRevenue/10).toLocaleString('fa-IR')} تومان`);
    console.log(`  نوبت‌های در انتظار: ${response.data.pendingAppointments}`);
    console.log(`  نوبت‌های تکمیل شده: ${response.data.completedAppointments}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (response.data.monthlyRevenue > 0) {
      console.log('🎉 موفق! درآمد ماهانه به درستی محاسبه شد!\n');
    } else {
      console.log('⚠️  هنوز 0 است. Backend باید reload شود.\n');
    }

  } catch (error) {
    console.error('❌ خطا:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testAdminStatsAPI();

