import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

async function testWithAuth() {
  try {
    console.log('🔍 Testing with authentication...');
    
    // First, login as admin
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'testadmin@example.com',
      password: 'admin123'
    });
    
    console.log('✅ Login successful');
    console.log('📊 Login response:', loginResponse.data);
    const token = loginResponse.data.access_token;
    console.log('🔑 Token:', token);
    
    // Set authorization header
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Get pending withdrawal requests
    const withdrawalsResponse = await axios.get(
      `${API_BASE_URL}/accounting/barbers/withdrawals?status=PENDING`,
      { headers: authHeaders }
    );
    console.log('📊 Pending withdrawals:', withdrawalsResponse.data);
    
    if (withdrawalsResponse.data.length === 0) {
      console.log('❌ No pending withdrawal requests found');
      return;
    }
    
    const withdrawal = withdrawalsResponse.data[0];
    console.log('📊 Selected withdrawal for testing:', withdrawal);
    
    // Get bank accounts
    const bankAccountsResponse = await axios.get(
      `${API_BASE_URL}/accounting/bank-accounts`,
      { headers: authHeaders }
    );
    console.log('📊 Bank accounts:', bankAccountsResponse.data);
    
    if (bankAccountsResponse.data.length === 0) {
      console.log('❌ No bank accounts found');
      return;
    }
    
    const bankAccount = bankAccountsResponse.data[0];
    
    // Test approval
    const approvalData = {
      adminId: 20, // Assuming admin ID
      bankAccountId: bankAccount.id,
      salonPercentage: 40,
    };
    
    console.log('🔍 Sending approval request:', {
      withdrawalId: withdrawal.id,
      data: approvalData,
    });
    
    const approvalResponse = await axios.post(
      `${API_BASE_URL}/accounting/barbers/withdrawals/${withdrawal.id}/approve`,
      approvalData,
      { headers: authHeaders }
    );
    
    console.log('✅ Approval response:', approvalResponse.data);
    
    // Check if withdrawal status changed
    const updatedWithdrawalResponse = await axios.get(
      `${API_BASE_URL}/accounting/barbers/withdrawals?status=APPROVED`,
      { headers: authHeaders }
    );
    const updatedWithdrawal = updatedWithdrawalResponse.data.find(w => w.id === withdrawal.id);
    console.log('📊 Updated withdrawal:', updatedWithdrawal);
    
    // Check if financial entries were created
    const entriesResponse = await axios.get(
      `${API_BASE_URL}/accounting/entries?limit=10`,
      { headers: authHeaders }
    );
    console.log('📊 Recent financial entries:', entriesResponse.data.entries.slice(0, 5));
    
    // Check barber balance
    const balanceResponse = await axios.get(
      `${API_BASE_URL}/accounting/barbers/balances`,
      { headers: authHeaders }
    );
    const barberBalance = balanceResponse.data.find(b => b.id === withdrawal.barberId);
    console.log('📊 Barber balance after approval:', barberBalance);
    
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
    if (error.response) {
      console.error('❌ Error status:', error.response.status);
      console.error('❌ Error data:', error.response.data);
    } else if (error.request) {
      console.error('❌ No response received:', error.request);
    } else {
      console.error('❌ Error setting up request:', error.message);
    }
  }
}

testWithAuth(); 