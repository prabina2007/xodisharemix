const nodemailer = require('nodemailer');

const sendOTPEmail = async (to, otp) => {
  // Always log OTP for Render logs
  console.log(`[RENDER LOG] Generated OTP for ${to}: ${otp}`);

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const port = Number(process.env.SMTP_PORT || 587);
  const isProduction = process.env.NODE_ENV === 'production';
  const allowDevFallback = process.env.ALLOW_DEV_OTP_LOG === 'true';

  // Try SMTP whenever credentials are configured (works in local + production).
  if (!host || !user || !pass) {
    if (!isProduction) {
      console.log(`[DEV OTP] Email to ${to}: ${otp}`);
      return { sent: false, mode: 'dev-log' };
    }
    return { sent: false, mode: 'smtp-missing' };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `xodisharemix.com <${user}>`,
      to,
      subject: 'Your xodisharemix.com OTP Code',
      text: `Your OTP is ${otp}. It expires in 10 minutes.`,
    });

    return { sent: true, mode: 'smtp' };
  } catch (error) {
    if (!isProduction && allowDevFallback) {
      console.log(`[DEV OTP] Email to ${to}: ${otp}`);
      return { sent: false, mode: 'dev-log' };
    }
    throw error;
  }
};

module.exports = { sendOTPEmail };
