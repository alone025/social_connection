const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function connectMongo() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in environment');
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(MONGODB_URI);

  console.log('Connected to MongoDB');
}

module.exports = {
  connectMongo,
};


