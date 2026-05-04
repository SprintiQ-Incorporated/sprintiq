import { NextResponse } from 'next/server';
import { generateMathCaptcha } from '@/lib/spam-protection';

/**
 * GET /api/captcha
 *
 * Generates a new math captcha for forms that require additional spam protection.
 * Returns a question and token that should be passed back with form submission.
 *
 * Response:
 * {
 *   question: "What is 3 + 7?",
 *   token: "base64encodedtoken..."
 * }
 *
 * Usage in forms:
 * 1. Fetch GET /api/captcha on form mount
 * 2. Display the question to the user
 * 3. Include captcha_answer and captcha_token in form submission
 */
export async function GET() {
  const captcha = generateMathCaptcha();

  return NextResponse.json({
    question: captcha.question,
    token: captcha.token
  });
}
