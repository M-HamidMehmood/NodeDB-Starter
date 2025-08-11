import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { env } from '../../../config/config';
import CustomError from '../../../errors';
import { createUser, getUserByEmail, getUserWithRole, updateUser, type UserWithRole } from '../../db/queries/users';
import { createHash, sendResetPasswordEmail, sendVerificationEmail } from '../../utils';

export type RegisterRequest = {
  email: string;
  name: string;
  password: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  user: UserWithRole;
  permissionNames: string[];
};

export type VerifyEmailRequest = {
  verificationToken: string;
  email: string;
};

export const register = async ({ email, name, password }: RegisterRequest): Promise<void> => {
  const emailAlreadyExists = await getUserByEmail(email);
  if (emailAlreadyExists) {
    throw new CustomError.BadRequestError('Email already exists');
  }

  const passwordHash = await bcrypt.hash(password, env.SALT_ROUNDS);
  const verificationToken = crypto.randomBytes(40).toString('hex');

  const user = await createUser({
    name,
    email,
    passwordHash,
    verificationToken,
  });

  await sendVerificationEmail({
    name: user.name,
    email: user.email,
    verificationToken: user.verificationToken || '',
  });
};

export const verifyEmail = async ({ verificationToken, email }: VerifyEmailRequest): Promise<void> => {
  const user = await getUserByEmail(email);

  if (!user) {
    throw new CustomError.UnauthenticatedError('Verification Failed');
  }

  if (user.verificationToken !== verificationToken) {
    throw new CustomError.UnauthenticatedError('Verification Failed');
  }

  await updateUser(user.id, {
    isVerified: true,
    verifiedAt: new Date(),
    verificationToken: null,
  });
};

export const login = async ({ email, password }: LoginRequest): Promise<LoginResponse> => {
  const user = await getUserWithRole(email);

  if (!user) {
    throw new CustomError.UnauthenticatedError('No user found with that email');
  }

  if (!user.isVerified) {
    throw new CustomError.UnauthenticatedError('Email not verified.');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new CustomError.UnauthenticatedError('Incorrect password');
  }

  // Extract permission names to a flat array
  const permissionNames = user.role.permissions.map(permission => permission.name);

  return {
    user,
    permissionNames,
  };
};

export const forgotPassword = async (email: string): Promise<void> => {
  const user = await getUserByEmail(email);

  if (user) {
    const passwordToken = crypto.randomBytes(70).toString('hex');

    // Send email
    await sendResetPasswordEmail({
      name: user.name,
      email: user.email,
      token: passwordToken,
    });

    const tenMinutes = 1000 * 60 * 10;
    const passwordTokenExpirationDate = new Date(Date.now() + tenMinutes);

    await updateUser(user.id, {
      passwordResetToken: createHash(passwordToken),
      passwordResetExpires: passwordTokenExpirationDate,
    });
  }
};

export const resetPassword = async (token: string, email: string, password: string): Promise<void> => {
  const user = await getUserByEmail(email);

  if (!user) {
    throw new CustomError.UnauthenticatedError('Invalid reset token');
  }

  if (!user.passwordResetToken || !user.passwordResetExpires) {
    throw new CustomError.UnauthenticatedError('Invalid reset token');
  }

  const currentTime = new Date();
  if (currentTime > user.passwordResetExpires) {
    throw new CustomError.UnauthenticatedError('Reset token has expired');
  }

  const hashedToken = createHash(token);
  if (hashedToken !== user.passwordResetToken) {
    throw new CustomError.UnauthenticatedError('Invalid reset token');
  }

  const passwordHash = await bcrypt.hash(password, env.SALT_ROUNDS);

  await updateUser(user.id, {
    passwordHash,
    passwordResetToken: null,
    passwordResetExpires: null,
  });
};
