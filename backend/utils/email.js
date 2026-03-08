const nodemailer = require('nodemailer');

const sendOTPEmail = async (to, otp) => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log(`[DEV OTP] Email to ${to}: ${otp}`);
    return { sent: false, mode: 'dev-log' };
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'xodisharemix.com <no-reply@xodisharemix.com>',
    to,
    subject: 'Your xodisharemix.com OTP Code',
    text: `Your OTP is ${otp}. It expires in 10 minutes.`,
  });

  return { sent: true, mode: 'smtp' };
};

module.exports = { sendOTPEmail };