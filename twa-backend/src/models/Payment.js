const mongoose = require('mongoose');

/**
 * Stores a payment order for post-conference access (249₽ tier).
 */
const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Types.ObjectId, ref: 'User', required: true, index: true },
  conference: { type: mongoose.Types.ObjectId, ref: 'Conference' },
  amount: { type: Number, required: true }, // In currency minor unit (kopecks for RUB)
  currency: { type: String, default: 'RUB' },
  status: {
    type: String,
    enum: ['pending', 'succeeded', 'failed', 'cancelled'],
    default: 'pending',
  },
  providerOrderId: { type: String }, // External payment provider's order ID
  providerPaymentUrl: { type: String }, // Redirect URL from provider
  paidAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
