const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function validateEmail(email: string): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) {
    return 'Enter a valid email address';
  }
  return null;
}

export function validatePassword(password: string, email = ''): string | null {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return 'Password must be 8-128 characters';
  }
  if (!password.trim()) return 'Password must be 8-128 characters';
  if (email && password.toLowerCase() === normalizeEmail(email)) {
    return 'Password cannot match the email';
  }
  return null;
}
