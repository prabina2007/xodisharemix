const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendOTPEmail } = require('../utils/email');

const makeToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('OTP email timeout')), ms)),
  ]);

const sendSignupOTP = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });

    if (existing && existing.isVerified) {
      return res.status(409).json({ message: 'User already exists. Please login.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    const user = existing || new User({ email: normalizedEmail, password: hashed });
    user.password = hashed;
    user.otpCode = otp;
    user.otpExpires = otpExpires;
    user.isVerified = false;
    await user.save();

    console.log(`[OTP] send requested for ${normalizedEmail}`);
    const result = await withTimeout(sendOTPEmail(normalizedEmail, otp), 12000);
    const isProduction = process.env.NODE_ENV === 'production';

    if (!result.sent && result.mode === 'smtp-missing' && isProduction) {
      return res.status(500).json({
        message: 'Email service is not configured on server. Please contact support.',
      });
    }

    if (!result.sent && result.mode !== 'dev-log') {
      return res.status(500).json({
        message: 'Failed to send OTP email. Please try again.',
      });
    }

    console.log(`[OTP] send result for ${normalizedEmail}: ${result.mode}`);

    return res.status(200).json({
      message: 'OTP sent successfully',
      delivery: result.mode,
      devOtp: !isProduction && result.mode === 'dev-log' ? otp : undefined,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send OTP', error: error.message });
  }
};

const verifySignupOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.otpCode || !user.otpExpires || user.otpExpires < new Date()) {
      return res.status(400).json({ message: 'OTP expired. Request new OTP.' });
    }

    if (String(user.otpCode) !== String(otp)) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = makeToken({ id: user._id, email: user.email, role: 'user' });

    return res.status(200).json({
      message: 'Account verified successfully',
      token,
      user: { id: user._id, email: user.email },
    });
  } catch (error) {
    return res.status(500).json({ message: 'OTP verification failed', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Please verify your email using OTP first' });
    }

    const token = makeToken({ id: user._id, email: user.email, role: 'user' });

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: user._id, email: user.email },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

module.exports = {
  sendSignupOTP,
  verifySignupOTP,
  login,
};
