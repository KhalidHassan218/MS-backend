import 'dotenv/config';
import { sendVerificationEmail } from './verification-email.js';

// Test single verification email
async function testSingleVerification() {
  try {
    console.log('📤 Sending verification email (English)...');
    
    const result = await sendVerificationEmail({
      email: 'omar3691113@gmail.com',
      verifyUrl: 'https://microsoftsupplier.com/verify?token=abc123xyz789',
      customerName: 'Omar',
      lang: 'EN'
    });
    
    console.log('✅ Email sent successfully!');
    console.log('📋 Details:', result);
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    console.error('Full error:', error);
  }
}

// Test all languages
async function testAllLanguages() {
  const languages = [
    { code: 'EN', name: 'English', customerName: 'Omar' },
    { code: 'DE', name: 'German', customerName: 'Omar' },
    { code: 'FR', name: 'French', customerName: 'Omar' },
    { code: 'ES', name: 'Spanish', customerName: 'Omar' },
    { code: 'NL', name: 'Dutch', customerName: 'Omar' },
  ];

  console.log('🚀 Starting verification email tests for all languages...\n');

  for (const lang of languages) {
    try {
      console.log(`📤 Sending ${lang.name} verification email...`);
      
      const result = await sendVerificationEmail({
        email: 'omar3691113@gmail.com',
        verifyUrl: `https://microsoftsupplier.com/verify?token=test-${lang.code.toLowerCase()}-123`,
        customerName: lang.customerName,
        lang: lang.code
      });
      
      console.log(`✅ ${lang.name} verification email sent successfully!`);
      console.log(`   Message ID: ${result.messageId || 'N/A'}`);
      
      // Wait 1 second between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Failed to send ${lang.name} email:`, error.message);
    }
    
    console.log(''); // Empty line for readability
  }
  
  console.log('🎉 All verification email tests completed!');
}

// Uncomment the test you want to run:

// Test single email (English only)
testSingleVerification();

// Test all languages (5 emails)
// testAllLanguages();