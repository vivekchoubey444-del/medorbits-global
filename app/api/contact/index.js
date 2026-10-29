'use strict';
const { json, methodOnly, parseBody, text, email, requestId, sameOriginIfConfigured, handleError } = require('../_lib/http');
const { insertSubmission } = require('../_lib/db');

module.exports = async function contact(req, res) {
  const id = requestId(req);
  if (!sameOriginIfConfigured(req, res)) return;
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (methodOnly(req, res, ['POST'])) return;
  try {
    const body = await parseBody(req, 20 * 1024);
    // Honeypot field: bots should fill this; silently reject without storing.
    if (text(body.website, 200)) return json(res, 202, { ok: true, message: 'Your request has been received.', requestId: id });
    const name = text(body.name, 120);
    const address = email(body.email);
    const message = text(body.message, 5000);
    const phone = text(body.phone, 40);
    if (name.length < 2) return json(res, 400, { error: 'Please provide your name.', requestId: id });
    if (!address) return json(res, 400, { error: 'Please provide a valid email address.', requestId: id });
    if (message.length < 10) return json(res, 400, { error: 'Message must contain at least 10 characters.', requestId: id });
    const saved = await insertSubmission('contact', { name, email: address, phone, message }, { source: 'contact-form' });
    return json(res, 201, { ok: true, message: 'Your message has been received.', id: saved.id, requestId: id });
  } catch (error) { return handleError(res, error, id); }
};
