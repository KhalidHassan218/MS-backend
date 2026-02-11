import dotenv from 'dotenv';
import { sendMail } from './mailersend.js';

dotenv.config();

async function testEmail() {
  try {
    const result = await sendMail({
      to: 'omar3691113@gmail.com', // Replace with your email
      subject: 'Test Email from Development',
      html: '<h1>Hello!</h1><p>This is a test email.</p>',
    });
    console.log('✅ Email sent:', result);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testEmail();