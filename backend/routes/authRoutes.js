const express = require('express');
const { sendSignupOTP, verifySignupOTP, login } = require('../controllers/authController');

const router = express.Router();

router.post('/signup/send-otp', sendSignupOTP);
router.post('/signup/verify-otp', verifySignupOTP);
router.post('/login', login);

module.exports = router;