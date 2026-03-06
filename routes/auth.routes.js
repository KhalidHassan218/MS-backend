import express from 'express';
import {
  requestPasswordReset,
  resetPassword,
  verifyResetToken,
} from '../controllers/passwordResetController.js';

const router = express.Router();

// Request password reset (sends email)
router.post('/password-reset/request', requestPasswordReset);

// Reset password with token
router.post('/password-reset/reset', resetPassword);

// Verify reset token (optional - to check token validity before showing form)
router.get('/password-reset/verify', verifyResetToken);

export default router;
