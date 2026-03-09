const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// static uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/songs', require('./routes/songRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', app: 'xodisharemix.com' });
});

// error handler
app.use((error, _req, res, _next) => {
  if (error) {
    return res.status(400).json({ message: error.message || 'Request failed' });
  }
  return res.status(500).json({ message: 'Unexpected server error' });
});

// root route
app.get('/', (_req, res) => {
  res.send('xodisharemix API is running');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});