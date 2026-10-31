const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const app = express();
const publicRoot = path.resolve(__dirname, '../public');

connectDB().then(
  () => console.log('MongoDB connected'),
  error => console.error('MongoDB unavailable; order and payment APIs will return 503:', error.message)
);

// Middleware
const allowedOrigins = new Set([
  process.env.CLIENT_URL,
  'http://localhost:5500',
  'http://127.0.0.1:5500',
].filter(Boolean));
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
}));
app.use(bodyParser.json({ limit: '8mb' }));

app.use('/api', (req, res, next) => {
  if (req.path === '/health' || mongoose.connection.readyState === 1) {
    return next();
  }
  res.status(503).json({
    error: 'The order database is unavailable. Check the MongoDB connection settings and restart the server.',
  });
});

// Routes
app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));

app.get('/api/health', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'degraded',
    database: ready ? 'connected' : 'disconnected',
  });
});
app.get('/', (req, res) => res.sendFile(path.join(publicRoot, 'index.html')));
app.get('/admin', (req, res) => res.redirect('/admin.html'));
app.use('/server', (req, res) => res.sendStatus(404));
app.use(express.static(publicRoot, {
  dotfiles: 'deny',
  index: 'index.html',
}));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));