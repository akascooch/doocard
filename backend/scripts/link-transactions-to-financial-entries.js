const { Client } = require('pg');

const zapasConfig = {
  host: 'localhost',
  port: 5433,
  database: 'zapas',
  user: 'postgres',
  password: 'Lord7know$'
};

async function linkTransactionsToFinancialEntries() {
  const client = new Client(zapasConfig);

  try {
    console.log('🔍 Connecting to zapas database...');
    await client.connect();
    console.log('✅ Connected to zapas database');

    // ابتدا بررسی کنیم که آیا ارتباطات وجود دارند
    const existingLinks = await client.query('SELECT COUNT(*) FROM transactions WHERE "financialEntryId" IS NOT NULL');
    console.log(`📊 Existing transaction-financial entry links: ${existingLinks.rows[0].count}`);

    if (parseInt(existingLinks.rows[0].count) === 0) {
      console.log('❌ No links found. Creating them...');
      
      // دریافت تراکنش‌ها و financial entries
      const transactions = await client.query(`
        SELECT 
          t.id,
          t."appointmentId",
          t.amount,
          t.status,
          t.category,
          t."paymentMethod",
          t."createdAt",
          a."barberId",
          c."firstName" as customer_first_name,
          c."lastName" as customer_last_name,
          b."firstName" as barber_first_name,
          b."lastName" as barber_last_name
        FROM transactions t
        LEFT JOIN appointments a ON t."appointmentId" = a.id
        LEFT JOIN customers c ON a."customerId" = c.id
        LEFT JOIN barbers b ON a."barberId" = b.id
        ORDER BY t.id
      `);

      const financialEntries = await client.query(`
        SELECT 
          id,
          type,
          amount,
          description,
          "categoryId",
          date,
          "createdAt"
        FROM financial_entries
        ORDER BY id
      `);

      console.log(`📊 Found ${transactions.rows.length} transactions and ${financialEntries.rows.length} financial entries`);

      // ایجاد ارتباط بین تراکنش‌ها و financial entries
      let linkedCount = 0;
      
      for (const transaction of transactions.rows) {
        // پیدا کردن financial entry مناسب
        let matchingEntry = null;
        
        for (const entry of financialEntries.rows) {
          // تطبیق بر اساس مبلغ، نوع و تاریخ
          if (entry.amount === transaction.amount && 
              Math.abs(new Date(entry.date).getTime() - new Date(transaction.createdAt).getTime()) < 24 * 60 * 60 * 1000) { // اختلاف کمتر از 24 ساعت
            
            // بررسی نوع تراکنش
            if (transaction.category === 'TIP' && entry.description?.includes('تیپ')) {
              matchingEntry = entry;
              break;
            } else if (transaction.category === 'SERVICE_PAYMENT' && entry.description?.includes('پرداخت خدمات')) {
              matchingEntry = entry;
              break;
            } else if (transaction.category === 'SALARY' && entry.description?.includes('پرداخت حقوق')) {
              matchingEntry = entry;
              break;
            }
          }
        }

        if (matchingEntry) {
          // بروزرسانی تراکنش با financial entry id
          await client.query(`
            UPDATE transactions 
            SET "financialEntryId" = $1
            WHERE id = $2
          `, [matchingEntry.id, transaction.id]);

          linkedCount++;
          console.log(`✅ Linked transaction ${transaction.id} to financial entry ${matchingEntry.id}`);
        } else {
          console.log(`⚠️  No matching financial entry found for transaction ${transaction.id} (amount: ${transaction.amount}, category: ${transaction.category})`);
        }
      }

      console.log(`✅ Linked ${linkedCount} transactions to financial entries`);
    } else {
      console.log('✅ Links already exist');
    }

    // بررسی نتیجه
    const finalCheck = await client.query(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT("financialEntryId") as transactions_with_financial_entry,
        COUNT(*) - COUNT("financialEntryId") as transactions_without_financial_entry
      FROM transactions
    `);

    const check = finalCheck.rows[0];
    console.log('\n📊 Final check:');
    console.log(`   Total transactions: ${check.total_transactions}`);
    console.log(`   Transactions with financial entry: ${check.transactions_with_financial_entry}`);
    console.log(`   Transactions without financial entry: ${check.transactions_without_financial_entry}`);

    // بررسی موجودی آرایشگران
    console.log('\n📊 Barber balances after linking:');
    const barberBalances = await client.query(`
      SELECT 
        b.id,
        b."firstName",
        b."lastName",
        COUNT(a.id) as total_appointments,
        COALESCE(SUM(CASE WHEN fe.type = 'INCOME' THEN fe.amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN fe.type = 'EXPENSE' THEN fe.amount ELSE 0 END), 0) as total_expenses,
        COALESCE(SUM(CASE WHEN fe.type = 'INCOME' THEN fe.amount ELSE 0 END), 0) - 
        COALESCE(SUM(CASE WHEN fe.type = 'EXPENSE' THEN fe.amount ELSE 0 END), 0) as balance
      FROM barbers b
      LEFT JOIN appointments a ON b.id = a."barberId"
      LEFT JOIN transactions t ON a.id = t."appointmentId"
      LEFT JOIN financial_entries fe ON t."financialEntryId" = fe.id
      GROUP BY b.id, b."firstName", b."lastName"
      ORDER BY b.id
    `);
    
    barberBalances.rows.forEach(row => {
      console.log(`   ${row.firstName} ${row.lastName}: ${row.total_appointments} appointments | Income: ${row.total_income} | Expenses: ${row.total_expenses} | Balance: ${row.balance}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

linkTransactionsToFinancialEntries(); 