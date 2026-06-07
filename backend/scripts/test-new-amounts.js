const { Client } = require('pg');

const zapasConfig = {
  host: 'localhost',
  port: 5433,
  database: 'zapas',
  user: 'postgres',
  password: 'Lord7know$'
};

async function testNewAmounts() {
  const client = new Client(zapasConfig);

  try {
    console.log('🔍 Connecting to zapas database...');
    await client.connect();
    console.log('✅ Connected to zapas database');

    // تست محاسبه مبالغ نوبت‌ها با الگوی جدید
    console.log('\n📊 Testing new appointment amounts calculation:');
    const appointmentsWithAmounts = await client.query(`
      SELECT 
        a.id,
        a.date,
        a.status,
        c."firstName" as customer_name,
        b."firstName" as barber_name,
        COUNT(t.id) as transaction_count,
        STRING_AGG(t.amount::text, ', ' ORDER BY t.amount DESC) as amounts_desc,
        SUM(t.amount) as total_amount
      FROM appointments a
      LEFT JOIN customers c ON a."customerId" = c.id
      LEFT JOIN barbers b ON a."barberId" = b.id
      LEFT JOIN transactions t ON a.id = t."appointmentId"
      GROUP BY a.id, a.date, a.status, c."firstName", b."firstName"
      ORDER BY a.id
      LIMIT 10
    `);
    
    appointmentsWithAmounts.rows.forEach(row => {
      let serviceAmount = 0;
      let tipAmount = 0;
      
      if (row.transaction_count > 0) {
        const amounts = row.amounts_desc.split(', ').map(Number);
        
        if (amounts.length === 1) {
          serviceAmount = amounts[0];
        } else {
          serviceAmount = amounts[0]; // بزرگترین مبلغ
          for (let i = 1; i < amounts.length; i++) {
            tipAmount += amounts[i];
          }
        }
      }
      
      console.log(`   Appointment ${row.id}: ${row.customer_name} -> ${row.barber_name}`);
      console.log(`     Transactions: ${row.transaction_count} | Amounts: ${row.amounts_desc}`);
      console.log(`     Service: ${serviceAmount} | Tip: ${tipAmount} | Total: ${row.total_amount} | Status: ${row.status}`);
      console.log('');
    });

    // تست محاسبه موجودی آرایشگران با الگوی جدید
    console.log('\n📊 Testing new barber balances calculation:');
    const barberBalances = await client.query(`
      SELECT 
        b.id,
        b."firstName",
        b."lastName",
        COUNT(DISTINCT a.id) as total_appointments,
        COUNT(t.id) as total_transactions
      FROM barbers b
      LEFT JOIN appointments a ON b.id = a."barberId"
      LEFT JOIN transactions t ON a.id = t."appointmentId"
      GROUP BY b.id, b."firstName", b."lastName"
      ORDER BY b.id
      LIMIT 5
    `);
    
    for (const barber of barberBalances.rows) {
      // محاسبه موجودی آرایشگر
      const appointments = await client.query(`
        SELECT 
          a.id,
          COUNT(t.id) as transaction_count,
          STRING_AGG(t.amount::text, ', ' ORDER BY t.amount DESC) as amounts_desc,
          SUM(t.amount) as total_amount
        FROM appointments a
        LEFT JOIN transactions t ON a.id = t."appointmentId"
        WHERE a."barberId" = $1
        GROUP BY a.id
      `, [barber.id]);

      let totalIncome = 0;
      let totalTips = 0;

      appointments.rows.forEach(apt => {
        if (apt.transaction_count > 0) {
          const amounts = apt.amounts_desc.split(', ').map(Number);
          
          if (amounts.length === 1) {
            totalIncome += amounts[0];
          } else {
            totalIncome += amounts[0]; // بزرگترین مبلغ
            for (let i = 1; i < amounts.length; i++) {
              totalTips += amounts[i];
            }
          }
        }
      });

      console.log(`   ${barber.firstName} ${barber.lastName}: ${barber.total_appointments} appointments | Income: ${totalIncome} | Tips: ${totalTips} | Total: ${totalIncome + totalTips}`);
    }

    // تست آمار روزانه
    console.log('\n📊 Testing daily stats calculation:');
    const dailyStats = await client.query(`
      SELECT 
        a.id,
        a.date,
        a.status,
        c."firstName" as customer_name,
        b."firstName" as barber_name,
        COUNT(t.id) as transaction_count,
        STRING_AGG(t.amount::text, ', ' ORDER BY t.amount DESC) as amounts_desc,
        SUM(t.amount) as total_amount
      FROM appointments a
      LEFT JOIN customers c ON a."customerId" = c.id
      LEFT JOIN barbers b ON a."barberId" = b.id
      LEFT JOIN transactions t ON a.id = t."appointmentId"
      WHERE DATE(a.date) = '2025-07-23'
      GROUP BY a.id, a.date, a.status, c."firstName", b."firstName"
      ORDER BY a.id
      LIMIT 5
    `);
    
    let dailyServiceAmount = 0;
    let dailyTipAmount = 0;
    let dailyTotalAmount = 0;

    dailyStats.rows.forEach(row => {
      let serviceAmount = 0;
      let tipAmount = 0;
      
      if (row.transaction_count > 0) {
        const amounts = row.amounts_desc.split(', ').map(Number);
        
        if (amounts.length === 1) {
          serviceAmount = amounts[0];
        } else {
          serviceAmount = amounts[0];
          for (let i = 1; i < amounts.length; i++) {
            tipAmount += amounts[i];
          }
        }
      }
      
      dailyServiceAmount += serviceAmount;
      dailyTipAmount += tipAmount;
      dailyTotalAmount += row.total_amount;
      
      console.log(`   Appointment ${row.id}: Service: ${serviceAmount} | Tip: ${tipAmount} | Total: ${row.total_amount}`);
    });

    console.log(`\n📊 Daily Summary: Service: ${dailyServiceAmount} | Tip: ${dailyTipAmount} | Total: ${dailyTotalAmount}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

testNewAmounts(); 