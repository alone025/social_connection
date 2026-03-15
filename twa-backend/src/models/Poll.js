const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  voters: [{ type: mongoose.Types.ObjectId, ref: 'User' }], // Track who voted
});

const pollSchema = new mongoose.Schema({
  conference: { type: mongoose.Types.ObjectId, ref: 'Conference', required: true, index: true },
  createdBy: { type: mongoose.Types.ObjectId, ref: 'User' },
  question: { type: String, required: true },
  options: [optionSchema],
  isActive: { type: Boolean, default: true },
  endsAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Poll', pollSchema);
