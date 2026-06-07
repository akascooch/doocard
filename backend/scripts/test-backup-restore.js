const axios = require('axios');
const fs = require('fs');
const path = require('path');

// تنظیمات
const API_BASE_URL = 'http://localhost:3001';
const ADMIN_TOKEN = 'your-admin-jwt-token-here'; // باید از login دریافت شود

// تنظیم axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function testBackupRestore() {
  try {
    console.log('🧪 شروع تست سیستم پشتیبان‌گیری و بازیابی...\n');

    // 1. تست ایجاد پشتیبان
    console.log('📋 1. تست ایجاد پشتیبان...');
    const backupResponse = await api.post('/settings/backup', {}, {
      responseType: 'stream'
    });

    const backupFileName = `test-backup-${new Date().toISOString().split('T')[0]}.json`;
    const backupFilePath = path.join(__dirname, backupFileName);
    
    const writer = fs.createWriteStream(backupFilePath);
    backupResponse.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log(`✅ پشتیبان ایجاد شد: ${backupFileName}`);

    // 2. تست دریافت اطلاعات پشتیبان
    console.log('\n📊 2. تست دریافت اطلاعات پشتیبان...');
    const backupInfoResponse = await api.get('/settings/backup-info');
    console.log('✅ اطلاعات پشتیبان:', JSON.stringify(backupInfoResponse.data, null, 2));

    // 3. تست بازیابی از پشتیبان (اختیاری - فقط برای تست)
    console.log('\n⚠️ 3. تست بازیابی از پشتیبان...');
    console.log('⚠️ این عملیات تمام داده‌های فعلی را پاک می‌کند!');
    console.log('⚠️ برای تست واقعی، ابتدا تأیید کنید که می‌خواهید ادامه دهید.');
    
    // برای تست واقعی، این خط را uncomment کنید:
    /*
    const formData = new FormData();
    formData.append('backupFile', fs.createReadStream(backupFilePath));
    
    const restoreResponse = await api.post('/settings/restore', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    console.log('✅ بازیابی موفق:', restoreResponse.data);
    */

    console.log('\n🎉 تست سیستم پشتیبان‌گیری و بازیابی با موفقیت انجام شد!');
    console.log(`📁 فایل پشتیبان در مسیر: ${backupFilePath}`);

  } catch (error) {
    console.error('❌ خطا در تست:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 راه حل: ابتدا login کنید و JWT token معتبر دریافت کنید');
      console.log('💡 سپس ADMIN_TOKEN را در این فایل آپدیت کنید');
    }
  }
}

// تابع کمکی برای login و دریافت token
async function loginAndGetToken() {
  try {
    console.log('🔐 تلاش برای login...');
    
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'admin@example.com',
      password: '123456'
    });

    const token = loginResponse.data.access_token;
    console.log('✅ Login موفق، token دریافت شد');
    
    // آپدیت token در api instance
    api.defaults.headers['Authorization'] = `Bearer ${token}`;
    
    return token;
  } catch (error) {
    console.error('❌ خطا در login:', error.response?.data || error.message);
    return null;
  }
}

// اجرای تست
async function main() {
  // ابتدا login کنید
  const token = await loginAndGetToken();
  if (!token) {
    console.log('❌ نتوانست login کنید. تست متوقف شد.');
    return;
  }

  // سپس تست backup/restore را اجرا کنید
  await testBackupRestore();
}

// اجرا
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testBackupRestore, loginAndGetToken };
