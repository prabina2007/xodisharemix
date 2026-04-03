const path = require('path');
const os = require('os');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

const appRoot = path.resolve(__dirname, '..');
const frontendRoot = path.join(appRoot, 'frontend');
const backendUploadsRoot = path.join(__dirname, 'uploads');

dotenv.config({ path: path.join(__dirname, '.env') });
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

const getLanIPv4 = () => {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      const family = typeof net.family === 'string' ? net.family : String(net.family);
      if (family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
};

const isLocalOrigin = (origin) => {
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    return false;
  } catch (_error) {
    return false;
  }
};

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' && isLocalOrigin(origin)) {
      return callback(null, true);
    }
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

app.use('/uploads', express.static(backendUploadsRoot));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/songs', require('./routes/songRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', app: 'xodisharemix.com', env: process.env.NODE_ENV || 'development' });
});

app.use(express.static(frontendRoot));

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendRoot, 'index.html'));
});

app.use((error, _req, res, _next) => {
  const statusCode = error.status || 500;
  const message = error.message || 'Unexpected server error';
  if (process.env.NODE_ENV !== 'production') {
    console.error(error);
  }
  res.status(statusCode).json({ message });
});

app.listen(PORT, HOST, () => {
  const lanIp = getLanIPv4();
  console.log(`Server running on port ${PORT}`);
  console.log(`Local URL: http://localhost:${PORT}`);
  if (lanIp) console.log(`Network URL: http://${lanIp}:${PORT}`);
  console.log(`CORS mode: ${allowedOrigins.length ? allowedOrigins.join(', ') : 'open (all origins)'}`);
});