'use strict';

const fs = require('node:fs');
const path = require('node:path');

const policyPath = path.join(__dirname, '..', 'policy', 'security-headers.json');
const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
const required = [
  'X-Content-Type-Options',
  'Referrer-Policy',
  'X-Frame-Options',
  'Permissions-Policy'
];
const missing = required.filter((name) => !policy.headers[name]);
const problems = [];
if (missing.length) problems.push(`Missing baseline headers: ${missing.join(', ')}`);
if (policy.headers['Access-Control-Allow-Origin'] === '*') {
  problems.push('Do not put wildcard CORS in the security header policy.');
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('MedOrbits header policy baseline is structurally valid.');
