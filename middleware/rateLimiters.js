import rateLimit from 'express-rate-limit';

const rateLimitResponse = (message) => ({
  success: false,
  message,
});

// POST /api/auth/password-reset/request — 3 per IP per hour
export const passwordResetRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Too many password reset requests. Please try again in an hour.'),
});

// POST /api/auth/password-reset/reset — 5 per IP per hour
// (higher than request since a user might have multiple tabs / retry)
export const passwordResetSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Too many password reset attempts. Please try again in an hour.'),
});

// POST /api/registerNewPendingUser — 3 per IP per hour
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Too many registration attempts. Please try again in an hour.'),
});

// Blanket limiter for all /api/auth/* routes — 10 per IP per 15 min
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Too many requests. Please try again in 15 minutes.'),
});
