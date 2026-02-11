import 'dotenv/config';  // ✅ Add this line at the top
import { sendAcceptanceEmail } from './client-emails.js';

async function sendTest() {
  try {
    console.log('📤 Sending acceptance email...');
    
    const result = await sendAcceptanceEmail({
      email: 'omar3691113@gmail.com',
      supplierId: 'SUP-2024-001',
      lang: 'en'
    });
    
    console.log('✅ Email sent successfully!');
    console.log('📋 Details:', result);
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    console.error('Full error:', error);
  }
}

sendTest();