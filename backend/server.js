const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server tools / curl (no Origin header)
    if (!origin) return callback(null, true);
    if (!allowedOrigins.length || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS not allowed for this origin'));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// static uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/songs', require('./routes/songRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', app: 'xodisharemix.com', env: process.env.NODE_ENV || 'development' });
});

// root route
app.get('/', (_req, res) => {
  res.status(200).json({ message: 'xodisharemix API is running' });
});

// API 404
app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

// error handler
app.use((error, _req, res, _next) => {
  const statusCode = error.status || 500;
  const message = error.message || 'Unexpected server error';
  if (process.env.NODE_ENV !== 'production') {
    console.error(error);
  }
  res.status(statusCode).json({ message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS mode: ${allowedOrigins.length ? allowedOrigins.join(', ') : 'open (all origins)'}`);
});
