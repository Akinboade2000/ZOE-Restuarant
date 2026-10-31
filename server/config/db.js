const mongoose = require('mongoose');

let connectionPromise;

mongoose.connection.on('disconnected', () => {
  connectionPromise = undefined;
});

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (mongoose.connection.readyState === 2) {
    return mongoose.connection.asPromise();
  }

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not configured');
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGO_URI, {
      family: 4,
    }).catch(error => {
      connectionPromise = undefined;
      throw error;
    });
  }

  await connectionPromise;
  return mongoose.connection;
};

module.exports = connectDB;