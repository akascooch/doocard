#!/usr/bin/env ts-node
import axios from 'axios';

async function testServicesEndpoint() {
  try {
    console.log('🔍 Testing /api/services/public endpoint...\n');

    const response = await axios.get('http://localhost:3001/api/services/public');

    console.log('✅ Status:', response.status);
    console.log('📦 Data type:', Array.isArray(response.data) ? 'Array' : typeof response.data);
    console.log('📊 Count:', Array.isArray(response.data) ? response.data.length : 'N/A');
    
    if (Array.isArray(response.data) && response.data.length > 0) {
      console.log('\n✅ Services found:\n');
      response.data.forEach((service: any, index: number) => {
        console.log(`${index + 1}. ${service.name} - ${service.price} تومان`);
      });
    } else {
      console.log('\n❌ Response data:', JSON.stringify(response.data, null, 2));
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Response:', error.response?.data);
  }
}

testServicesEndpoint();

