import * as bcrypt from 'bcrypt';

async function generatePasswords() {
  const password = '123456';
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log('Hashed password:', hashedPassword);
}

generatePasswords(); 