import nodemailer from 'nodemailer';
import type { Options } from 'nodemailer/lib/smtp-transport';
import { emailConfig } from '../../config/config';

export type EmailOptions = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

const sendEmail = async ({ to, subject, html, text }: EmailOptions): Promise<void> => {
  const transporter = nodemailer.createTransport(emailConfig as Options);

  await transporter.sendMail({
    from: emailConfig.auth?.user || 'noreply@example.com',
    to,
    subject,
    html,
    text,
  });
};

export default sendEmail;
