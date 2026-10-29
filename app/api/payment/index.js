'use strict';
const { json, methodOnly, parseBody, text, email, requestId, sameOriginIfConfigured, handleError } = require('../_lib/http');

module.exports = async function payment(req, res) {
  const id = requestId(req);
  if (!sameOriginIfConfigured(req, res)) return;
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (methodOnly(req, res, ['POST'])) return;
  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID || !process.env.APP_BASE_URL) {
      const error = new Error('Payment provider is not configured.');
      error.statusCode = 503;
      throw error;
    }
    const body = await parseBody(req, 8 * 1024);
    const address = body.email ? email(body.email) : '';
    if (body.email && !address) return json(res, 400, { error: 'Invalid email address.', requestId: id });
    const successUrl = new URL('/payment/success?session_id={CHECKOUT_SESSION_ID}', process.env.APP_BASE_URL).toString();
    const cancelUrl = new URL('/payment/cancel', process.env.APP_BASE_URL).toString();
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      ...(address ? { customer_email: address } : {}),
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { source: 'medorbits-api' }
    }, { idempotencyKey: `medorbits-checkout-${id}` });
    return json(res, 201, { ok: true, checkoutUrl: session.url, sessionId: session.id, requestId: id });
  } catch (error) { return handleError(res, error, id); }
};
