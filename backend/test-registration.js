const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { requestRegisterOtp } = require('./lib/registration');

async function testRegistration() {
  try {
    console.log('Testing registration OTP...');
    const result = await requestRegisterOtp('test5', 'test5@gmail.com', 'test123', '127.0.0.1');
    console.log('Result:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

testRegistration();
