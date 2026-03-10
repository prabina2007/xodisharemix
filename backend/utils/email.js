const nodemailer = require('nodemailer');

const sendOTPEmail = async (to, otp) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const port = Number(process.env.SMTP_PORT || 587);

  // Local/dev mode: always log OTP and return dev-log
  if (!isProduction) {
    console.log(`[DEV OTP] Email to ${to}: ${otp}`);
    return { sent: false, mode: 'dev-log' };
  }

  if (!host || !user || !pass) {
    return { sent: false, mode: 'smtp-missing' };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `xodisharemix.com <${user}>`,
    to,
    subject: 'Your xodisharemix.com OTP Code',
    text: `Your OTP is ${otp}. It expires in 10 minutes.`,
  });

  return { sent: true, mode: 'smtp' };
};

module.exports = { sendOTPEmail };
