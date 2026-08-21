import { AuthTokenType } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import { AuthError } from '@/lib/auth/errors';
import { sendPasswordResetEmail, sendVerificationEmail } from '@/lib/auth/email';
import { hashPassword, verifyPassword } from '@/lib/auth/password.js';
import { createRawToken, hashToken } from '@/lib/auth/tokens.js';
import { normalizeEmail, validateEmail, validatePassword } from '@/lib/auth/validation.js';
import { createSession, revokeAllSessions } from '@/lib/auth/session';

const VERIFY_TTL_MS = 24 * 60 * 60 * 1_000;
const RESET_TTL_MS = 60 * 60 * 1_000;

export async function registerAccount(input: { email?: string; password?: string }) {
  const email = normalizeEmail(input.email || '');
  const emailError = validateEmail(email);
  const passwordError = validatePassword(input.password || '', email);
  if (emailError) throw new AuthError('INVALID_EMAIL', 400);
  if (passwordError) throw new AuthError('INVALID_PASSWORD', 400);

  const prisma = getPrisma();
  const existing = await prisma.authUser.findUnique({ where: { email } });
  if (existing) return;

  const passwordHash = await hashPassword(input.password!);
  const authUser = await prisma.authUser.create({ data: { email, passwordHash } });
  await issueTokenAndEmail(authUser.id, email, 'email_verification');
}

export async function loginAccount(input: { email?: string; password?: string }, request: Request) {
  const email = normalizeEmail(input.email || '');
  const authUser = await getPrisma().authUser.findUnique({
    where: { email },
    include: { user: { select: { id: true } } },
  });
  if (!authUser || authUser.status !== 'active' || !await verifyPassword(input.password || '', authUser.passwordHash)) {
    throw new AuthError('INVALID_CREDENTIALS', 401);
  }
  if (!authUser.emailVerifiedAt) throw new AuthError('EMAIL_NOT_VERIFIED', 403);

  const session = await createSession(authUser.id, request);
  return {
    session,
    user: {
      id: authUser.id,
      email: authUser.email,
      emailVerified: true,
      hasProfile: Boolean(authUser.user),
      profileUserId: authUser.user?.id || null,
    },
  };
}

export async function verifyEmailToken(rawToken: string) {
  const prisma = getPrisma();
  await prisma.$transaction(async tx => {
    const now = new Date();
    const record = await tx.authToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    if (!record || record.type !== 'email_verification' || record.usedAt || record.expiresAt <= now) {
      throw new AuthError('INVALID_OR_EXPIRED_TOKEN', 400);
    }
    const consumed = await tx.authToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) throw new AuthError('INVALID_OR_EXPIRED_TOKEN', 400);
    await tx.authUser.update({ where: { id: record.authUserId }, data: { emailVerifiedAt: now } });
  });
}

export async function resendVerification(emailInput: string) {
  const email = normalizeEmail(emailInput);
  const authUser = await getPrisma().authUser.findUnique({ where: { email } });
  if (authUser && !authUser.emailVerifiedAt && authUser.status === 'active') {
    await issueTokenAndEmail(authUser.id, email, 'email_verification');
  }
}

export async function requestPasswordReset(emailInput: string) {
  const email = normalizeEmail(emailInput);
  const authUser = await getPrisma().authUser.findUnique({ where: { email } });
  if (authUser?.emailVerifiedAt && authUser.status === 'active') {
    await issueTokenAndEmail(authUser.id, email, 'password_reset');
  }
}

export async function resetPassword(rawToken: string, password: string) {
  const passwordError = validatePassword(password);
  if (passwordError) throw new AuthError('INVALID_PASSWORD', 400);

  const prisma = getPrisma();
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async tx => {
    const now = new Date();
    const record = await tx.authToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    if (!record || record.type !== 'password_reset' || record.usedAt || record.expiresAt <= now) {
      throw new AuthError('INVALID_OR_EXPIRED_TOKEN', 400);
    }
    const consumed = await tx.authToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) throw new AuthError('INVALID_OR_EXPIRED_TOKEN', 400);
    await tx.authUser.update({ where: { id: record.authUserId }, data: { passwordHash } });
    await tx.session.updateMany({ where: { authUserId: record.authUserId, revokedAt: null }, data: { revokedAt: now } });
  });
}

export async function changePassword(authUserId: string, currentPassword: string, newPassword: string) {
  const passwordError = validatePassword(newPassword);
  if (passwordError) throw new AuthError('INVALID_PASSWORD', 400);
  const authUser = await getPrisma().authUser.findUnique({ where: { id: authUserId } });
  if (!authUser || !await verifyPassword(currentPassword, authUser.passwordHash)) {
    throw new AuthError('INVALID_CREDENTIALS', 401);
  }
  await getPrisma().authUser.update({ where: { id: authUserId }, data: { passwordHash: await hashPassword(newPassword) } });
  await revokeAllSessions(authUserId);
}

async function issueTokenAndEmail(authUserId: string, email: string, type: AuthTokenType) {
  const prisma = getPrisma();
  const rawToken = createRawToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (type === 'email_verification' ? VERIFY_TTL_MS : RESET_TTL_MS));
  await prisma.authToken.updateMany({
    where: { authUserId, type, usedAt: null },
    data: { usedAt: now },
  });
  await prisma.authToken.create({ data: { authUserId, type, tokenHash: hashToken(rawToken), expiresAt } });
  if (type === 'email_verification') await sendVerificationEmail(email, rawToken);
  else await sendPasswordResetEmail(email, rawToken);
}
