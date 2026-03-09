const nodemailer = require('nodemailer');

const sendOTPEmail = async (to, otp) => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!host || !user || !pass) {
    if (isProduction) {
      return { sent: false, mode: 'smtp-missing' };
    }
    console.log(`[DEV OTP] Email to ${to}: ${otp}`);
    return { sent: false, mode: 'dev-log' };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `xodisharemix.com <${user}>`,
      to,
      subject: 'Your xodisharemix.com OTP Code',
      text: `Your OTP is ${otp}. It expires in 10 minutes.`,
    });
  } catch (error) {
    console.error('[SMTP] sendMail failed:', error.message);
    throw error;
  }

  return { sent: true, mode: 'smtp' };
};

module.exports = { sendOTPEmail };
