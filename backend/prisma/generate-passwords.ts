import * as bcrypt from 'bcrypt';

async function generatePasswords() {
  const password = process.env.GENERATE_PASSWORD;
  if (!password) {
    console.error('GENERATE_PASSWORD is required.');
    process.exit(1);
  }
  await bcrypt.hash(password, 10);
  console.log('Password hash generated. The hash was not printed.');
}

generatePasswords();
