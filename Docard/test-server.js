const axios = require('axios');

async function testServer() {
  try {
    const response = await axios.get('http://localhost:3001/health');
    console.log('Server response:', response.data);
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

testServer(); 