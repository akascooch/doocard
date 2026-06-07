#!/usr/bin/env ts-node
import axios from 'axios';

async function testEmployeesByService() {
  const serviceId = 2; // اصلاح مو

  try {
    console.log(`🔍 Testing /api/employees/by-service/${serviceId} endpoint...\n`);

    const response = await axios.get(`http://localhost:3001/api/employees/by-service/${serviceId}`);

    console.log('✅ Status:', response.status);
    console.log('📦 Data type:', Array.isArray(response.data) ? 'Array' : typeof response.data);
    console.log('📊 Count:', Array.isArray(response.data) ? response.data.length : 'N/A');
    
    if (Array.isArray(response.data) && response.data.length > 0) {
      console.log('\n✅ Employees found:\n');
      response.data.forEach((emp: any, index: number) => {
        console.log(`${index + 1}. ${emp.name || emp.user?.name || 'Unknown'}`);
      });
    } else {
      console.log('\n⚠️ No employees found for service', serviceId);
      console.log('Response:', JSON.stringify(response.data, null, 2));
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
  }
}

testEmployeesByService();

