const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  conference: { type: mongoose.Types.ObjectId, ref: 'Conference', required: true, index: true },
  askedBy: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, maxlength: 1000 },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  votes: [{ type: mongoose.Types.ObjectId, ref: 'User' }], // Upvotes
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);
