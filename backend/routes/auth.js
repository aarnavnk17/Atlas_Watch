'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const { User } = require('../models');
const { signToken } = require('../middleware/auth');
const { normalizeEmail, isValidEmail } = require('../lib/text');
const config = require('../config');

const router = express.Router();

// Credential endpoints are the obvious brute-force target and were previously
// unthrottled.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.authRateLimit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Try again in a few minutes.' },
});

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) return false;
  return /[A-Z]/.test(password) && /[0-9]/.test(password) && /[!@#$%^&*(),.?":{}|<>]/.test(password);
}

router.post('/register', credentialLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required', error: 'Email and password are required' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Enter a valid email address', error: 'Invalid email' });
  }
  if (!validatePassword(password)) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one number, and one special character.',
      error: 'Invalid password format',
    });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  try {
    await User.create({ email, password: hashedPassword });
  } catch (err) {
    const duplicate = err.code === 11000;
    const msg = duplicate ? 'Email already registered' : 'Registration failed';
    if (!duplicate) console.error('Registration error:', err.message);
    return res.status(400).json({ success: false, message: msg, error: msg });
  }

  console.log(`User registered: ${email}`);
  return res.json({ success: true, token: signToken(email), email });
});

router.post('/login', credentialLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required', error: 'Email and password are required' });
  }

  // `password` is select:false on the schema, so it has to be requested here.
  const user = await User.findOne({ email }).select('+password').lean();
  const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;

  if (!user || !passwordMatches) {
    // Identical response either way so the endpoint can't be used to enumerate accounts.
    return res.status(401).json({ success: false, message: 'Invalid credentials', error: 'Invalid credentials' });
  }

  console.log(`User logged in: ${user.email}`);
  return res.json({ success: true, token: signToken(user.email), email: user.email });
});

/** Lets a client check whether a stored token is still valid on launch. */
router.get('/session', require('../middleware/auth').requireAuth, async (req, res) => {
  const user = await User.findOne({ email: req.userEmail }).lean();
  if (!user) return res.status(401).json({ success: false, code: 'unknown_user', message: 'Account no longer exists' });
  return res.json({ success: true, email: user.email, profileCompleted: Boolean(user.profile_completed) });
});

module.exports = router;
