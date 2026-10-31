const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const app = express();
const publicRoot = path.resolve(__dirname, '../public');

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
app.use(express.json({ limit: '4mb' }));

app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();

  connectDB().then(
    () => next(),
    error => {
      console.error('MongoDB unavailable:', error.message);
      res.status(503).json({
        error: 'The order database is unavailable. Check the MongoDB connection settings.',
      });
    }
  );
});

app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));

app.get('/api/health', async (req, res) => {
  try {
    await connectDB();
    res.json({
      status: 'ready',
      database: 'connected',
    });
  } catch (error) {
    console.error('Health check could not connect to MongoDB:', error.message);
    res.status(503).json({
      status: 'degraded',
      database: 'disconnected',
    });
  }
});
app.get('/', (req, res) => res.sendFile(path.join(publicRoot, 'index.html')));
app.get('/admin', (req, res) => res.redirect('/admin.html'));
app.use('/server', (req, res) => res.sendStatus(404));
app.use(express.static(publicRoot, {
  dotfiles: 'deny',
  index: 'index.html',
}));

module.exports = app;
