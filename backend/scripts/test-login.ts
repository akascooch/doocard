import axios from 'axios';

async function testLogin() {
  try {
    console.log('🔵 Testing login...');

    const response = await axios.post('http://127.0.0.1:3001/api/auth/login', {
      identifier: '09370504588',
      password: 'Lord7knows',
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    console.log('✅ Login successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('');
    console.log('🎉 Login works! You can now login from browser.');

  } catch (error: any) {
    console.error('❌ Login failed!');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

testLogin();

