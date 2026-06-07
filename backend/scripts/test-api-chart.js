const axios = require('axios');

async function testChartAPI() {
  try {
    console.log('🧪 Testing chart API endpoint...\n');

    // تست endpoint نمودار
    const baseURL = 'http://localhost:3000'; // یا آدرس سرور شما
    
    console.log('📊 Testing /accounting/chart endpoint...');
    
    try {
      const response = await axios.get(`${baseURL}/accounting/chart?months=6`);
      console.log('✅ Chart API response:');
      console.log('Status:', response.status);
      console.log('Data length:', response.data.length);
      
      // نمایش داده‌های نمودار
      response.data.forEach((item, index) => {
        console.log(`${index + 1}. ${item.month} (${item.year}):`);
        console.log(`   Income: ${item.income.toLocaleString('fa-IR')}`);
        console.log(`   Expense: ${item.expense.toLocaleString('fa-IR')}`);
        console.log(`   Month Index: ${item.monthIndex}`);
        console.log('');
      });
      
    } catch (error) {
      console.log('❌ Chart API error:');
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Data:', error.response.data);
      } else {
        console.log('Error:', error.message);
      }
    }

    // تست endpoint آمار
    console.log('\n📊 Testing /accounting/stats endpoint...');
    
    try {
      const statsResponse = await axios.get(`${baseURL}/accounting/stats`);
      console.log('✅ Stats API response:');
      console.log('Status:', statsResponse.status);
      console.log('Data:', {
        totalIncome: statsResponse.data.totalIncome?.toLocaleString('fa-IR'),
        totalExpense: statsResponse.data.totalExpense?.toLocaleString('fa-IR'),
        balance: statsResponse.data.balance?.toLocaleString('fa-IR'),
        monthlyIncome: statsResponse.data.monthlyIncome?.toLocaleString('fa-IR'),
        monthlyExpense: statsResponse.data.monthlyExpense?.toLocaleString('fa-IR')
      });
      
    } catch (error) {
      console.log('❌ Stats API error:');
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Data:', error.response.data);
      } else {
        console.log('Error:', error.message);
      }
    }

    console.log('\n✅ API test completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testChartAPI();
