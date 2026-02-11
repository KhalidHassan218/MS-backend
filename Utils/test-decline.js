import 'dotenv/config';
import { sendDeclineEmail } from './client-emails.js';

async function sendTest() {
  try {
    console.log('📤 Sending decline email...');
    
    const result = await sendDeclineEmail({
      email: 'omar3691113@gmail.com',
      lang: 'nl'
    });
    
    console.log('✅ Email sent successfully!');
    console.log('📋 Details:', result);
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    console.error('Full error:', error);
  }
}

sendTest();