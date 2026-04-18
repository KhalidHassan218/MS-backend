const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verifies a Cloudflare Turnstile token.
 * Returns true if valid, false otherwise.
 * If no secret key is configured, skips verification (dev fallback).
 */
export async function verifyTurnstileToken(token, ip) {
  if (!TURNSTILE_SECRET) return true;
  if (!token) return false;

  const body = new URLSearchParams({
    secret: TURNSTILE_SECRET,
    response: token,
    ...(ip && { remoteip: ip }),
  });

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    body,
  });

  const data = await response.json();
  return data.success === true;
}
