const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Conference = require('../models/Conference');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const PRICE_AMOUNT = 24900; // 249 ₽ in kopecks
const CURRENCY = 'RUB';

/**
 * POST /payment/initiate
 * Body: { conferenceCode }
 * Creates a payment order with the configured payment provider.
 * Returns a payment URL for the user to complete payment.
 *
 * NOTE: You must fill in your payment provider's SDK/API here.
 * Common Russian providers: YooKassa, Robokassa, Cloudpayments, etc.
 */
router.post('/initiate', authMiddleware, async (req, res) => {
  const { conferenceCode } = req.body;

  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });
    const conf = conferenceCode
      ? await Conference.findOne({ code: conferenceCode.toUpperCase() })
      : null;

    // Check if user already has active paid access
    if (user.hasPaidAccess && user.paidAccessUntil > new Date()) {
      return res.json({ alreadyPaid: true, paidUntil: user.paidAccessUntil });
    }

    // --- INTEGRATE YOUR PAYMENT PROVIDER HERE ---
    // Example with YooKassa (requires `@a2seven/yoo-checkout` npm package):
    //
    // const { YooCheckout } = require('@a2seven/yoo-checkout');
    // const checkout = new YooCheckout({
    //   shopId: process.env.PAYMENT_SHOP_ID,
    //   secretKey: process.env.PAYMENT_API_KEY,
    // });
    // const payment = await checkout.createPayment({
    //   amount: { value: '249.00', currency: CURRENCY },
    //   confirmation: {
    //     type: 'redirect',
    //     return_url: `${process.env.PAYMENT_REDIRECT_URL}?userId=${user.telegramId}`,
    //   },
    //   capture: true,
    //   description: `Доступ к Social Connections – ${conf?.name || 'Все конференции'}`,
    //   metadata: { telegramId: user.telegramId, conferenceId: conf?._id?.toString() },
    // });
    //
    // Save the order and return redirect URL:
    // const order = await Payment.create({
    //   user: user._id,
    //   conference: conf?._id,
    //   amount: PRICE_AMOUNT,
    //   currency: CURRENCY,
    //   providerOrderId: payment.id,
    //   providerPaymentUrl: payment.confirmation.confirmation_url,
    // });
    // return res.json({ paymentUrl: order.providerPaymentUrl, orderId: order._id });
    // ---

    // Placeholder response until provider is integrated:
    const mockOrder = await Payment.create({
      user: user._id,
      conference: conf?._id,
      amount: PRICE_AMOUNT,
      currency: CURRENCY,
      providerOrderId: `MOCK-${Date.now()}`,
      providerPaymentUrl: `${process.env.PAYMENT_REDIRECT_URL || 'https://payment.example.com'}?demo=true`,
    });

    res.json({
      orderId: mockOrder._id,
      amount: PRICE_AMOUNT,
      currency: CURRENCY,
      paymentUrl: mockOrder.providerPaymentUrl,
      note: 'Integrate your payment provider in routes/payment.js',
    });
  } catch (err) {
    console.error('Payment initiate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /payment/callback
 * Webhook called by the payment provider on success.
 * Verify the payment and grant access.
 */
router.post('/callback', async (req, res) => {
  // TODO: Verify the signature from your payment provider before trusting this request
  const { orderId, status } = req.body;

  try {
    if (status === 'succeeded' || status === 'success') {
      const order = await Payment.findById(orderId).populate('user');
      if (!order) return res.status(404).json({ error: 'Order not found' });

      order.status = 'succeeded';
      order.paidAt = new Date();
      await order.save();

      // Grant 365 days of paid access
      const paidUntil = new Date();
      paidUntil.setFullYear(paidUntil.getFullYear() + 1);

      await User.findByIdAndUpdate(order.user._id, {
        hasPaidAccess: true,
        paidAccessUntil: paidUntil,
      });

      console.log(`✅ Payment succeeded for user ${order.user.telegramId}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Payment callback error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /payment/status
 * Returns the current user's payment / access status.
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });
    res.json({
      hasPaidAccess: user.hasPaidAccess,
      paidAccessUntil: user.paidAccessUntil,
      isActive: user.hasPaidAccess && user.paidAccessUntil > new Date(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
