const axios = require('axios');

async function registerAdmin() {
  try {
    const response = await axios.post('http://localhost:3001/auth/register', {
      email: 'admin2@example.com',
      password: 'admin123',
      firstName: 'ادمین',
      lastName: 'سیستم',
      phoneNumber: '09120000000',
      role: 'ADMIN'
    });
    console.log('User registered successfully:', response.data);
  } catch (error) {
    if (error.response) {
      console.error('Registration failed:', {
        status: error.response.status,
        data: error.response.data
      });
    } else {
      console.error('Error:', error.message);
    }
  }
}

registerAdmin(); 