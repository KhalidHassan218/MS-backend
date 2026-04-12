import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { sendMail } from '../Utils/mailersend.js';
import generatePasswordResetEmail from '../services/emails/generatePasswordResetEmail.js';

/**
 * Request a password reset
 * Creates a reset token and sends email
 */
export async function requestPasswordReset(req, res) {
  try {
    const { email, language = 'EN' } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Check if user exists in Supabase Auth
    const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers();

    if (userError) {
      console.error('Error fetching users:', userError);
      // Don't reveal if user exists or not for security
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, we sent a password reset link.',
      });
    }

    const user = users.users.find((u) => u.email === email);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'USER_NOT_FOUND',
      });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store token in database (create table if doesn't exist)
    // First, ensure the table exists
    await ensurePasswordResetTableExists();

    // Delete any existing tokens for this email
    await supabaseAdmin
      .from('password_reset_tokens')
      .delete()
      .eq('email', email);

    // Insert new token
    const { error: insertError } = await supabaseAdmin
      .from('password_reset_tokens')
      .insert({
        email,
        token_hash: hashedToken,
        expires_at: expiresAt.toISOString(),
        user_id: user.id,
      });

    if (insertError) {
      console.error('Error storing reset token:', insertError);
      return res.status(500).json({
        success: false,
        message: 'Failed to process password reset request',
      });
    }

    // Build reset URL
    const frontendUrl = process.env.FRONT_DOMAIN || 'https://www.microsoftsupplier.com';
    const resetUrl = `${frontendUrl}/update-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Generate email
    const { subject, html } = generatePasswordResetEmail(resetUrl, language);

    // Send email
    const emailResult = await sendMail({
      to: email,
      subject,
      html,
      fromName: 'Microsoft Supplier',
    });

    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send password reset email',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Password reset email sent successfully',
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while processing your request',
    });
  }
}

/**
 * Reset password with token
 * Verifies token and updates password
 */
export async function resetPassword(req, res) {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, token, and new password are required',
      });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    // Hash the token to match what we stored
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find the token in database
    const { data: resetTokenData, error: tokenError } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('*')
      .eq('email', email)
      .eq('token_hash', hashedToken)
      .single();

    if (tokenError || !resetTokenData) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    // Check if token is expired
    const expiresAt = new Date(resetTokenData.expires_at);
    if (expiresAt < new Date()) {
      // Delete expired token
      await supabaseAdmin
        .from('password_reset_tokens')
        .delete()
        .eq('email', email);

      return res.status(400).json({
        success: false,
        message: 'Reset token has expired. Please request a new one.',
      });
    }

    // Update user password using Supabase Admin
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      resetTokenData.user_id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to update password',
      });
    }

    // Delete used token
    await supabaseAdmin
      .from('password_reset_tokens')
      .delete()
      .eq('email', email);

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while resetting your password',
    });
  }
}

/**
 * Verify reset token (optional endpoint to check if token is valid before showing form)
 */
export async function verifyResetToken(req, res) {
  try {
    const { email, token } = req.query;

    if (!email || !token) {
      return res.status(400).json({
        success: false,
        message: 'Email and token are required',
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const { data: resetTokenData, error: tokenError } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('expires_at')
      .eq('email', email)
      .eq('token_hash', hashedToken)
      .single();

    if (tokenError || !resetTokenData) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset token',
      });
    }

    const expiresAt = new Date(resetTokenData.expires_at);
    if (expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Reset token has expired',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Token is valid',
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while verifying token',
    });
  }
}

/**
 * Ensure password_reset_tokens table exists
 * Run this once or add to your database migrations
 */
async function ensurePasswordResetTableExists() {
  // Note: This should ideally be done through Supabase SQL migrations
  // For now, we'll attempt to create it, ignoring if it already exists

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      user_id UUID NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_password_reset_email ON password_reset_tokens(email);
    CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at);
  `;

  try {
    await supabaseAdmin.rpc('exec_sql', { sql: createTableSQL });
  } catch (error) {
    // Table likely already exists or RPC not available, ignore
    console.log('Table creation skipped (may already exist)');
  }
}
