const { Client } = require('pg');

const zapasConfig = {
  host: 'localhost',
  port: 5433,
  database: 'zapas',
  user: 'postgres',
  password: 'Lord7know$'
};

async function fixFinancialEntries() {
  const client = new Client(zapasConfig);

  try {
    console.log('🔍 Connecting to zapas database...');
    await client.connect();
    console.log('✅ Connected to zapas database');

    // ابتدا بررسی کنیم که آیا financial_entries وجود دارند
    const existingEntries = await client.query('SELECT COUNT(*) FROM financial_entries');
    console.log(`📊 Existing financial entries: ${existingEntries.rows[0].count}`);

    if (parseInt(existingEntries.rows[0].count) === 0) {
      console.log('❌ No financial entries found. Creating them from transactions...');
      
      // ایجاد financial entries از تراکنش‌ها
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

      console.log(`📊 Found ${transactions.rows.length} transactions to process`);

      for (const transaction of transactions.rows) {
        // تعیین نوع financial entry
        let type = 'INCOME';
        let description = '';
        let categoryId = null;

        if (transaction.category === 'TIP') {
          type = 'INCOME';
          description = `تیپ برای ${transaction.customer_first_name} ${transaction.customer_last_name} - ${transaction.barber_first_name} ${transaction.barber_last_name}`;
          categoryId = 7; // تیپ
        } else if (transaction.category === 'SERVICE_PAYMENT') {
          type = 'INCOME';
          description = `پرداخت خدمات - ${transaction.customer_first_name} ${transaction.customer_last_name} - ${transaction.barber_first_name} ${transaction.barber_last_name}`;
          categoryId = 1; // درآمد خدمات
        } else if (transaction.category === 'SALARY') {
          type = 'EXPENSE';
          description = `پرداخت حقوق به ${transaction.barber_first_name} ${transaction.barber_last_name}`;
          categoryId = 2; // حقوق
        } else {
          type = 'INCOME';
          description = `تراکنش ${transaction.category} - ${transaction.customer_first_name} ${transaction.customer_last_name}`;
          categoryId = 1; // درآمد خدمات
        }

        // ایجاد financial entry
        const financialEntryResult = await client.query(`
          INSERT INTO financial_entries (
            type,
            amount,
            description,
            "categoryId",
            date,
            "createdAt",
            "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [
          type,
          transaction.amount,
          description,
          categoryId,
          transaction.createdAt,
          transaction.createdAt,
          transaction.createdAt
        ]);

        const financialEntryId = financialEntryResult.rows[0].id;

        // بروزرسانی تراکنش با financial entry id
        await client.query(`
          UPDATE transactions 
          SET "financialEntryId" = $1
          WHERE id = $2
        `, [financialEntryId, transaction.id]);

        console.log(`✅ Created financial entry ${financialEntryId} for transaction ${transaction.id}`);
      }

      console.log('✅ All financial entries created successfully');
    } else {
      console.log('✅ Financial entries already exist');
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
    console.log('\n📊 Barber balances after fix:');
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

fixFinancialEntries(); 