import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

async function testWithdrawalApprovalAPI() {
  try {
    console.log('🔍 Testing withdrawal approval API endpoint...');
    
    // First, get pending withdrawal requests
    const withdrawalsResponse = await axios.get(`${API_BASE_URL}/accounting/barbers/withdrawals?status=PENDING`);
    console.log('📊 Pending withdrawals:', withdrawalsResponse.data);
    
    if (withdrawalsResponse.data.length === 0) {
      console.log('❌ No pending withdrawal requests found');
      return;
    }
    
    const withdrawal = withdrawalsResponse.data[0];
    console.log('📊 Selected withdrawal for testing:', withdrawal);
    
    // Get bank accounts
    const bankAccountsResponse = await axios.get(`${API_BASE_URL}/accounting/bank-accounts`);
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
      approvalData
    );
    
    console.log('✅ Approval response:', approvalResponse.data);
    
    // Check if withdrawal status changed
    const updatedWithdrawalResponse = await axios.get(`${API_BASE_URL}/accounting/barbers/withdrawals?status=APPROVED`);
    console.log('📊 Updated withdrawal:', updatedWithdrawalResponse.data.find(w => w.id === withdrawal.id));
    
    // Check if financial entries were created
    const entriesResponse = await axios.get(`${API_BASE_URL}/accounting/entries?limit=10`);
    console.log('📊 Recent financial entries:', entriesResponse.data.entries.slice(0, 5));
    
    // Check barber balance
    const balanceResponse = await axios.get(`${API_BASE_URL}/accounting/barbers/balances`);
    const barberBalance = balanceResponse.data.find(b => b.id === withdrawal.barberId);
    console.log('📊 Barber balance after approval:', barberBalance);
    
  } catch (error) {
    console.error('❌ Error testing API:', error.response?.data || error.message);
    console.error('❌ Error status:', error.response?.status);
    console.error('❌ Error headers:', error.response?.headers);
  }
}

testWithdrawalApprovalAPI(); 