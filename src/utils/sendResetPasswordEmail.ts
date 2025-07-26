import sendEmail from './sendEmail';

export type ResetPasswordEmailOptions = {
  name: string;
  email: string;
  token: string;
};

const sendResetPasswordEmail = async ({ name, email, token }: ResetPasswordEmailOptions): Promise<void> => {
  const resetURL = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}&email=${email}`;

  const html = `
    <h2>Hello ${name}</h2>
    <p>Please click the link below to reset your password:</p>
    <a href="${resetURL}">Reset Password</a>
    <p>If you didn't request this, please ignore this email.</p>
  `;

  await sendEmail({
    to: email,
    subject: 'Password Reset Request',
    html,
  });
};

export default sendResetPasswordEmail;
