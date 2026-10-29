'use strict';
const { json, methodOnly, parseBody, text, email, requestId, sameOriginIfConfigured, handleError } = require('../_lib/http');
const { insertSubmission } = require('../_lib/db');

module.exports = async function lead(req, res) {
  const id = requestId(req);
  if (!sameOriginIfConfigured(req, res)) return;
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (methodOnly(req, res, ['POST'])) return;
  try {
    const body = await parseBody(req, 16 * 1024);
    if (text(body.website, 200)) return json(res, 202, { ok: true, requestId: id });
    const name = text(body.name, 120);
    const address = email(body.email);
    const phone = text(body.phone, 40);
    const course = text(body.course, 160);
    const city = text(body.city, 120);
    const message = text(body.message, 3000);
    if (name.length < 2) return json(res, 400, { error: 'Please provide your name.', requestId: id });
    if (!address && !/^\+?[0-9 ()-]{7,20}$/.test(phone)) {
      return json(res, 400, { error: 'Provide a valid email address or phone number.', requestId: id });
    }
    const saved = await insertSubmission('lead', { name, email: address, phone, message }, { course, city, source: 'lead-form' });
    return json(res, 201, { ok: true, message: 'Your enquiry has been received.', id: saved.id, requestId: id });
  } catch (error) { return handleError(res, error, id); }
};
