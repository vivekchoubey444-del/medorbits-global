
# MedOrbits Node Infrastructure

Centralized Node.js runtime management for MedOrbits.

## Requirements

- Node.js >= 20
- npm >= 10

## Setup

From the repository root:

```bash
cd node
npm install
```

## Validation

```bash
npm run check
npm run validate
npm test
```

## Security

```bash
npm audit
```

## Health

```bash
npm run health
```

## Policies

- Preserve the existing application architecture.
- Do not overwrite root package.json.
- Do not automatically change production dependencies.
- Back up configuration before modifications.
- Keep environment secrets outside source control.
- Run CI before deployment.
