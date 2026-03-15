const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/social_connections_twa';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ MongoDB connected:', uri);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  MongoDB not available. Start MongoDB or set MONGO_URI in .env');
      console.warn('   The server will start, but database operations will fail.\n');
    } else {
      throw err; // Fatal in production
    }
  }
}

module.exports = { connectDB };
