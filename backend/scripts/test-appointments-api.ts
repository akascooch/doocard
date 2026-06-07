import axios from 'axios';

async function testAppointmentsAPI() {
  try {
    console.log('🔍 Testing appointments API...');
    
    // Test with barber user
    const barberEmail = 'scooch@example.com';
    
    // First, login as barber to get token
    const loginResponse = await axios.post('http://localhost:3001/auth/login', {
      email: barberEmail,
      password: 'password123' // Assuming this is the password
    });
    
    const token = loginResponse.data.access_token;
    console.log('🔑 Got token:', token ? 'Yes' : 'No');
    
    // Set authorization header
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    // Test appointments endpoint
    console.log('📊 Testing appointments endpoint...');
    const appointmentsResponse = await axios.get('http://localhost:3001/appointments');
    console.log('📊 Appointments count:', appointmentsResponse.data.length);
    appointmentsResponse.data.forEach((apt: any) => {
      console.log(`- Appointment ${apt.id}: ${apt.customer?.firstName} ${apt.customer?.lastName} - Status: ${apt.status}`);
    });
    
    // Test daily stats endpoint
    console.log('📊 Testing daily stats endpoint...');
    const today = new Date().toISOString().split('T')[0];
    const statsResponse = await axios.get(`http://localhost:3001/appointments/daily-stats/${today}`);
    console.log('📊 Daily stats:', statsResponse.data.stats);
    console.log('📊 Appointments in stats:', statsResponse.data.appointments.length);
    
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testAppointmentsAPI(); 