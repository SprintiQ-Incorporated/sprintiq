/**
 * Spam Protection Utilities
 *
 * Lightweight spam protection for public endpoints using:
 * - Honeypot fields: Hidden form fields that bots fill, humans ignore
 * - Math captcha: Simple verification that's easy for humans, annoying for bots
 *
 * Usage:
 * 1. Add honeypot fields to forms (hidden from users via CSS)
 * 2. Call checkHoneypot() on the server to reject bot submissions
 * 3. For high-value forms, add math captcha via /api/captcha
 */

export interface HoneypotFields {
  website?: string;      // Honeypot - should be empty
  phone_number?: string; // Honeypot - should be empty
  fax?: string;          // Honeypot - should be empty
}

export interface CaptchaFields extends HoneypotFields {
  captcha_answer?: string;
  captcha_token?: string;
}

/**
 * Check honeypot fields - bots fill these hidden fields, humans don't
 *
 * Add hidden fields to your forms:
 * <input type="text" name="website" style="position: absolute; left: -9999px" tabIndex={-1} />
 *
 * These fields should be invisible to users but bots will fill them out.
 * If any honeypot field has a value, the submission is likely from a bot.
 */
export function checkHoneypot(data: HoneypotFields): { valid: boolean; reason?: string } {
  if (data.website && data.website.trim() !== '') {
    return { valid: false, reason: 'honeypot_website' };
  }
  if (data.phone_number && data.phone_number.trim() !== '') {
    return { valid: false, reason: 'honeypot_phone' };
  }
  if (data.fax && data.fax.trim() !== '') {
    return { valid: false, reason: 'honeypot_fax' };
  }
  return { valid: true };
}

/**
 * Generate a simple math captcha
 *
 * Returns a question like "What is 3 + 7?" and a secure token.
 * The token contains the encrypted answer and expiration time.
 */
export function generateMathCaptcha(): { question: string; answer: string; token: string } {
  const a = Math.floor(Math.random() * 10) + 1; // 1-10
  const b = Math.floor(Math.random() * 10) + 1; // 1-10
  const answer = (a + b).toString();

  // Create a simple token (base64 encoded JSON with answer and expiry)
  // In production, consider using JWT or encrypted tokens
  const tokenData = {
    answer,
    expires: Date.now() + 300000 // 5 minutes
  };
  const token = Buffer.from(JSON.stringify(tokenData)).toString('base64');

  return {
    question: `What is ${a} + ${b}?`,
    answer,
    token
  };
}

/**
 * Verify math captcha answer
 *
 * Validates that:
 * 1. The token is valid and hasn't expired
 * 2. The user's answer matches the expected answer
 */
export function verifyCaptcha(answer: string, token: string): { valid: boolean; reason?: string } {
  if (!answer || !token) {
    return { valid: false, reason: 'captcha_missing' };
  }

  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());

    // Check if token has expired
    if (Date.now() > decoded.expires) {
      return { valid: false, reason: 'captcha_expired' };
    }

    // Compare answers (trim whitespace)
    if (answer.trim() !== decoded.answer) {
      return { valid: false, reason: 'captcha_incorrect' };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'captcha_invalid' };
  }
}

/**
 * Combined check for both honeypot and captcha
 *
 * Use this for high-value forms like contact forms.
 */
export function checkSpamProtection(
  data: CaptchaFields,
  options: { requireCaptcha?: boolean } = {}
): { valid: boolean; reason?: string } {
  // First check honeypot fields
  const honeypotResult = checkHoneypot(data);
  if (!honeypotResult.valid) {
    return honeypotResult;
  }

  // Check captcha if required
  if (options.requireCaptcha) {
    if (!data.captcha_answer || !data.captcha_token) {
      return { valid: false, reason: 'captcha_required' };
    }
    return verifyCaptcha(data.captcha_answer, data.captcha_token);
  }

  return { valid: true };
}
