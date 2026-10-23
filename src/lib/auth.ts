import { cookies } from 'next/headers';
import crypto from 'crypto';

const COOKIE_NAME = 'office_auth';

function getAuthToken(): string {
  const secret = process.env.APP_PASSWORD || '';
  if (!secret) return '';
  return crypto.createHash('sha256').update(`kantor-ai:${secret}`).digest('hex');
}

/**
 * Checks if authentication is required (APP_PASSWORD is set)
 */
export function isAuthRequired(): boolean {
  return Boolean(process.env.APP_PASSWORD && process.env.APP_PASSWORD.trim().length > 0);
}

/**
 * Checks if current request has valid session cookie
 */
export function checkAuth(): boolean {
  if (!isAuthRequired()) return true;

  try {
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    const expectedToken = getAuthToken();
    return Boolean(token && expectedToken && token === expectedToken);
  } catch {
    return false;
  }
}

/**
 * Validates a plain password input against APP_PASSWORD
 */
export function validatePassword(password: string): boolean {
  if (!isAuthRequired()) return true;
  return password === process.env.APP_PASSWORD;
}

/**
 * Generates the auth token to be stored in the cookie
 */
export function generateAuthCookieValue(): string {
  return getAuthToken();
}

export { COOKIE_NAME };
