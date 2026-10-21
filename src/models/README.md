
# MedOrbits Database Models

**Directory:** `src/models/`

**Runtime:** Node.js >= 20  
**Module system:** CommonJS  
**Database:** MySQL 8+

## 1. Purpose

The models directory defines trusted database entity metadata and field allowlists used by the MedOrbits repository layer.

MedOrbits uses plain CommonJS model-definition modules rather than requiring an ORM. These modules identify database tables, permitted columns, searchable fields, and default ordering. Where necessary, they also document field restrictions, validation limits, status values, and sensitive-data policies.

Model definitions describe the intended database contract. They do not independently create tables, validate incoming requests, enforce authorization, or guarantee that the deployed MySQL schema matches the application.

## 2. Directory Structure

The following is the intended model inventory. Confirm each file exists and matches its repository and database migration.

```text
src/models/
├── user.model.js
├── session.model.js
├── role.model.js
├── course.model.js
├── college.model.js
├── university.model.js
├── application.model.js
├── admission.model.js
├── document.model.js
├── candidate.model.js
├── employer.model.js
├── job.model.js
├── internship.model.js
├── notification.model.js
├── payment.model.js
└── subscription.model.js
```

## 3. Database Standards

| Setting | Convention |
|—|—|
| Database engine | MySQL 8+ |
| Character set | `utf8mb4` |
| Module format | CommonJS |
| Primary keys | Auto-incrementing integer IDs, where appropriate |
| Creation timestamp | `created_at` |
| Update timestamp | `updated_at` |
| JSON column naming | Suffix `_json` |
| Query interface | Parameterized SQL through the database layer |

These are project conventions, not universal assumptions. Existing tables may use different primary keys, data types, or timestamp behavior. Follow the verified schema for each entity.

## 4. Model Responsibilities

A model definition may specify:

- `TABLE`: the trusted database table name.
- `COLUMNS`: the permitted column identifiers.
- `SEARCHABLE`: the columns permitted in repository search.
- `DEFAULT_ORDER`: the default sorting column.
- `STATUSES`: application-level status values, where relevant.
- `IMMUTABLE_FIELDS`: fields that should not be changed through ordinary update operations.
- `SENSITIVE_FIELDS`: fields requiring restricted access.
- `SERVER_MANAGED_FIELDS`: fields that should be changed only by trusted application workflows.
- `VALIDATION_LIMITS`: documented constraints for service-layer validation.

Optional constants are useful only when the application actually consumes or tests them. They must remain consistent with service logic and database constraints.

## 5. Standard Model Contract

The standard repository factory currently expects `TABLE`, `COLUMNS`, `SEARCHABLE`, and `DEFAULT_ORDER`.

Example: `src/models/user.model.js`

```javascript
‘use strict’;

const TABLE = ‘users’;

const COLUMNS = Object.freeze([
  ‘id’,
  ‘name’,
  ‘email’,
  ‘password_hash’,
  ‘phone’,
  ‘status’,
  ‘email_verified_at’,
  ‘created_at’,
  ‘updated_at’,
]);

const SEARCHABLE = Object.freeze([
  ‘name’,
  ‘email’,
  ‘phone’,
]);

const DEFAULT_ORDER = ‘id’;

module.exports = Object.freeze({
  TABLE,
  COLUMNS,
  SEARCHABLE,
  DEFAULT_ORDER,
});
```

Preserve this export contract unless `base.repository.js` and all dependent repositories are deliberately updated together.

`Object.freeze()` prevents accidental modification of the exported arrays and objects at runtime, but it does not validate the database schema or enforce access permissions.

## 6. Repository Integration

The intended data-access flow is:

```text
Controller
    |
    v
Service
    |
    v
Repository
    |
    v
Model allowlists
    |
    v
MySQL
```

Repositories should consume trusted model definitions instead of accepting table names, column names, or SQL fragments from requests.

For example:

```javascript
‘use strict’;

const { createRepository } = require(‘./base.repository’);
const model = require(‘../models/user.model’);

module.exports = createRepository({
  table: model.TABLE,
  columns: model.COLUMNS,
  searchable: model.SEARCHABLE,
  defaultOrder: model.DEFAULT_ORDER,
});
```

The generic repository must validate identifiers and bind values using parameterized queries. Sort directions must be restricted to supported values, and sorting must use an explicit column allowlist.

**Important:** A column being present in `COLUMNS` means the generic repository may accept it; it does not mean every caller should be allowed to read or modify it.

## 7. Insert and Update Field Policies

A production repository should distinguish between:

- Columns that may be read.
- Columns that may be inserted.
- Columns that may be updated.
- Columns that require privileged service operations.
- Columns that must never be exposed through public responses.

These policies should be enforced by the repository or the relevant service, not merely documented in model constants.

Examples:

| Field | Required policy |
|—|—|
| `id` | Generated or managed by the database |
| `password_hash` | Written only through trusted authentication workflows |
| `token_hash` | Restricted to authentication services |
| `storage_key` | Restricted to document-storage workflows |
| `status` | Updated through validated state transitions |
| `permissions_json` | Restricted to privileged role-management operations |
| `amount_minor` | Set from trusted billing data |
| `verified_at` | Set only after successful server-side verification |

Do not expose unrestricted generic create, update, or delete operations directly to public API callers.

## 8. JSON Column Handling

JSON fields use the `_json` suffix as a naming convention. Examples include `form_data_json`, `skills_json`, `metadata_json`, and `permissions_json`.

The database driver and actual column type determine how values should be written and read. Do not assume every JSON column requires manual serialization.

Example when the repository contract expects a serialized string:

```javascript
‘use strict’;

const preferences = {
  language: ‘en’,
  notifications: true,
};

const preferencesJson = JSON.stringify(preferences);
```

Before persistence:

- Validate the input against an explicit schema.
- Reject unsupported fields and unexpected structures.
- Apply size and nesting limits where appropriate.
- Avoid storing passwords, authentication tokens, or unnecessary sensitive data.
- Handle malformed JSON and unexpected database values safely.

For MySQL `JSON` columns, confirm the behavior of the installed driver and binding configuration before choosing whether to pass an object or a serialized string.

## 9. Sensitive Data and API Responses

Model allowlists are not public response schemas. Sensitive fields must not be exposed merely because they are included in a model.

Examples include:

- `password_hash`
- Session and access-token hashes
- Private document storage keys
- Internal file paths
- Payment credentials or confidential provider metadata
- Private application data
- Internal authorization metadata

Use explicit response serializers or DTOs to return only the fields required for a specific endpoint. Apply field-level authorization when access depends on the caller’s role or relationship to the resource.

Never rely on frontend filtering to protect confidential fields.

## 10. Status and Workflow Consistency

When models define status constants, those constants must agree with the relevant service and database schema.

Examples include:

- User account status.
- College and university publication status.
- Application review status.
- Document approval status.
- Job and internship publication status.
- Employer verification status.
- Payment status.
- Subscription lifecycle status.

Do not automatically share status lists between unrelated entities. A `verified` employer and a `published` job represent different business states and require different transition rules.

Status changes should be validated in services and protected against concurrent updates where necessary. Database constraints should reinforce critical invariants.

## 11. Schema Integrity and Migrations

Model definitions must remain consistent with the deployed MySQL schema.

Verify:

- Column names and data types.
- Nullability and default values.
- Primary and foreign keys.
- Unique constraints.
- Indexes for frequently queried fields.
- Timestamp defaults and update behavior.
- JSON column types.
- Referential integrity and deletion behavior.
- Monetary precision and currency conventions.
- Status constraints and migration compatibility.

Use version-controlled migrations for schema changes. Do not blindly apply development schema files to production databases.

A controlled deployment should review and test migrations, verify backups and recovery procedures, apply changes through a defined process, and check application compatibility after deployment.

## 12. Testing Requirements

Model and repository tests should cover:

- Valid and invalid table and column identifiers.
- Searchable-column allowlists.
- Insertable and updateable field restrictions.
- SQL injection attempts through values and identifiers.
- JSON serialization and schema validation.
- Missing and nullable fields.
- Primary-key and unique-constraint behavior.
- Foreign-key relationships and deletion rules.
- Sensitive-field exclusion from public serializers.
- Consistency between models and migrations.
- Repository compatibility with the actual MySQL schema.

Use unit tests for isolated logic and integration tests against a controlled MySQL environment for real query, constraint, and transaction behavior.

Mock-only tests cannot prove compatibility with the deployed schema.

## 13. Production Readiness Checklist

- [ ] Model definitions match the approved MySQL schema.
- [ ] The established CommonJS export contract is preserved.
- [ ] Table and column identifiers use trusted allowlists.
- [ ] Read, insert, and update permissions are appropriately separated.
- [ ] Sensitive fields are excluded from public API responses.
- [ ] JSON fields follow documented driver and serialization behavior.
- [ ] Foreign keys, unique constraints, and indexes are reviewed.
- [ ] Database migrations are version-controlled and tested.
- [ ] Services enforce ownership and workflow authorization.
- [ ] Concurrent state transitions are handled safely.
- [ ] Unit and integration tests cover critical database behavior.
- [ ] Backup, recovery, and deployment procedures are documented.

## 14. Implementation Status

This document describes the intended model architecture. It does not certify that every model file, database table, migration, repository operation, validation rule, or test is implemented or verified.

Before production deployment, verify the actual source files, repository contracts, MySQL schema, migration history, service integrations, and automated test results.

**MedOrbits — Study · Work · Grow**
