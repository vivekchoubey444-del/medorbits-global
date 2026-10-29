{
  "name": "medorbits-local-agent",
  "version": "1.0.0",
  "private": true,
  "description": "Local automation, repository validation, security checks, and maintenance utilities for MedOrbits.",
  "license": "UNLICENSED",
  "engines": {
    "node": ">=22.0.0",
    "npm": ">=10.0.0"
  },
  "type": "commonjs",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "check": "npm run check:json && npm run check:javascript",
    "check:json": "node scripts/validate-json.js",
    "check:javascript": "node scripts/check-javascript.js",
    "test": "node --test",
    "lockfile:generate": "npm install --package-lock-only --ignore-scripts --no-audit --no-fund",
    "lockfile:validate": "node -e \"const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));const l=JSON.parse(fs.readFileSync('package-lock.json','utf8'));if(l.name!==p.name||l.version!==p.version)process.exit(1);console.log('Lockfile metadata validated')\""
  },
  "dependencies": {},
  "devDependencies": {}
}
