import sendEmail from './sendEmail';

export type VerificationEmailOptions = {
  name: string;
  email: string;
  verificationToken: string;
};

const sendVerificationEmail = async ({ name, email, verificationToken }: VerificationEmailOptions): Promise<void> => {
  const verificationURL = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}&email=${email}`;

  const html = `
    <h2>Hello ${name}</h2>
    <p>Thank you for signing up! Please click the link below to verify your email:</p>
    <a href="${verificationURL}">Verify Email</a>
    <p>If you didn't create an account, please ignore this email.</p>
  `;

  await sendEmail({
    to: email,
    subject: 'Email Verification',
    html,
  });
};

export default sendVerificationEmail;
