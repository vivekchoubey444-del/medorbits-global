'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { json, methodOnly, requestId } = require('../_lib/http');

module.exports = async function download(req, res) {
  const id = requestId(req);
  if (methodOnly(req, res, ['GET', 'HEAD'])) return;
  // Set DOWNLOAD_FILES_JSON to a JSON object mapping public IDs to absolute,
  // deployment-accessible file paths. Never accept a user-supplied filesystem path.
  let files;
  try { files = JSON.parse(process.env.DOWNLOAD_FILES_JSON || '{}'); }
  catch { return json(res, 500, { error: 'Download configuration is invalid.', requestId: id }); }
  const key = typeof req.query?.file === 'string' ? req.query.file : '';
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(key) || !Object.prototype.hasOwnProperty.call(files, key)) {
    return json(res, 404, { error: 'File not found.', requestId: id });
  }
  const filePath = files[key];
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
    return json(res, 500, { error: 'Download configuration is invalid.', requestId: id });
  }
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return json(res, 404, { error: 'File not found.', requestId: id });
    const filename = path.basename(filePath).replace(/[\r\n"\\]/g, '_');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(stat.size));
    if (req.method === 'HEAD') { res.statusCode = 200; return res.end(); }
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => { if (!res.headersSent) json(res, 500, { error: 'Download failed.', requestId: id }); else res.destroy(); });
    stream.pipe(res);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EACCES') return json(res, 404, { error: 'File not found.', requestId: id });
    console.error(`[api:${id}]`, error.message);
    return json(res, 500, { error: 'Download failed.', requestId: id });
  }
};
