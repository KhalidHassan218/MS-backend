import express from 'express';
import {
  requestPasswordReset,
  resetPassword,
  verifyResetToken,
} from '../controllers/passwordResetController.js';
import {
  authLimiter,
  passwordResetRequestLimiter,
  passwordResetSubmitLimiter,
} from '../middleware/rateLimiters.js';
import requireAuth from '../middleware/auth.js';
import { sendMail } from '../Utils/mailersend.js';
import generateMfaEnrolledEmail from '../services/emails/generateMfaEnrolledEmail.js';

const router = express.Router();

router.use(authLimiter);

// Request password reset (sends email)
router.post('/password-reset/request', passwordResetRequestLimiter, requestPasswordReset);

// Reset password with token
router.post('/password-reset/reset', passwordResetSubmitLimiter, resetPassword);

// Verify reset token (optional - to check token validity before showing form)
router.get('/password-reset/verify', verifyResetToken);

// Notify user that MFA was just enrolled on their account
router.post('/mfa-enrolled', requireAuth, async (req, res) => {
  try {
    const { email, language, userName } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    const { subject, html } = generateMfaEnrolledEmail({ language, userName });
    await sendMail({ to: email, subject, html });

    res.json({ success: true });
  } catch (err) {
    console.error('MFA enrolled email error:', err);
    res.status(500).json({ success: false });
  }
});

export default router;
