
# MedOrbits Repositories

**Directory:** `src/repositories/`

## 1. Purpose

The repository layer provides controlled database access for MedOrbits. It centralizes MySQL queries, enforces server-defined table and column allowlists, and separates persistence logic from application business rules.

Repositories are used by services to retrieve and persist data. Controllers handle HTTP requests and responses, while services enforce business rules and coordinate repository operations.

**Runtime:** Node.js >= 20  
**Module system:** CommonJS  
**Database:** MySQL

## 2. Repository Directory Structure

```text
src/repositories/
├── base.repository.js
├── user.repository.js
├── session.repository.js
├── course.repository.js
├── college.repository.js
├── university.repository.js
├── application.repository.js
├── document.repository.js
├── job.repository.js
├── candidate.repository.js
├── employer.repository.js
├── payment.repository.js
├── subscription.repository.js
└── internship.repository.js
```

The directory above represents the intended repository layout. Verify that each file, corresponding model, database table, and required migration exists before considering that repository implemented.

## 3. Repository Responsibilities

Repositories are responsible for:

- Executing parameterized MySQL queries.
- Restricting table and column identifiers to trusted model definitions.
- Retrieving, inserting, updating, and deleting records where supported.
- Validating pagination and sorting inputs.
- Returning predictable data structures to services.
- Supporting conditional updates for concurrency-sensitive operations.
- Participating in transactions when workflows require atomic database changes.
- Propagating database errors without exposing sensitive internals to clients.

Repositories must not independently implement HTTP response handling, authentication, role-based authorization, or application workflow decisions.

## 4. Base Repository

The `base.repository.js` module provides shared database operations through a repository factory.

Example:

```javascript
‘use strict’;

const { createRepository } = require(‘./base.repository’);
const model = require(‘../models/course.model’);

module.exports = createRepository({
  table: model.TABLE,
  columns: model.COLUMNS,
  searchable: model.SEARCHABLE,
  defaultOrder: model.DEFAULT_ORDER,
});
```

Each model must define its permitted table, columns, searchable fields, and default ordering column.

The base repository should validate these definitions when the repository is initialized.

### Security requirements

- Table names must originate from trusted model definitions.
- Column names must belong to the configured column allowlist.
- Search values, identifiers, and other untrusted values must use parameterized query bindings.
- Sort columns must be allowlisted.
- Sort direction must be restricted to `ASC` or `DESC`.
- Create and update operations must reject fields that are not permitted.
- Primary keys and immutable fields must not be modified through generic update operations.
- SQL fragments must never be constructed from untrusted input.

Parameterized queries protect values, not arbitrary SQL identifiers. Identifier validation and value binding are separate requirements.

## 5. Repository Inventory

| Repository | Primary responsibility |
|—|—|
| `user.repository.js` | User records and profile persistence |
| `session.repository.js` | Session records and session lifecycle |
| `course.repository.js` | Course information |
| `college.repository.js` | College information |
| `university.repository.js` | University information |
| `application.repository.js` | Admission and service applications |
| `document.repository.js` | Document metadata and record persistence |
| `job.repository.js` | Job listings |
| `candidate.repository.js` | Candidate profiles and job-seeking records |
| `employer.repository.js` | Employer profiles and records |
| `payment.repository.js` | Payment records and transaction references |
| `subscription.repository.js` | Subscription records and lifecycle data |
| `internship.repository.js` | Internship listings |

The generic repository API is not necessarily sufficient for every domain. Authentication, document access, payment processing, subscriptions, and application status transitions may require specialized repository methods.

## 6. Expected Repository Interface

The generic repository currently provides the following interface, subject to the implementation in `base.repository.js`:

```javascript
{
  table,
  columns,
  findById,
  list,
  create,
  update,
  remove,
  updateIfStatusMatches
}
```

Method behavior:

- `findById(id)`: Retrieves a record by its primary key.
- `list(params)`: Retrieves a paginated and optionally filtered record collection.
- `create(data)`: Inserts a record containing permitted fields.
- `update(id, data)`: Updates permitted fields for an existing record.
- `remove(id)`: Deletes a record where deletion is supported.
- `updateIfStatusMatches(id, expectedStatus, data)`: Performs a conditional update when the record’s current status matches the expected value.

The conditional update requires a `status` column. It should be used for state transitions that need concurrency protection.

These operations do not automatically enforce ownership, administrative permissions, or domain-specific validation.

## 7. Authorization and Ownership

Authorization must be enforced by the appropriate service or controller before protected records are accessed or modified.

Examples:

- Users must not access another user’s restricted profile data.
- Candidates must not access another candidate’s private documents or applications.
- Employers must not modify another employer’s restricted records.
- Payment records must not be modified through unrestricted generic CRUD endpoints.
- Subscription changes must follow the subscription and payment workflow.
- Administrative operations must require verified administrative privileges.

Use resource-specific authorization checks, not merely a logged-in session check.

For sensitive operations, combine authorization with database-level ownership conditions where practical. This reduces the risk of time-of-check/time-of-use errors and accidental cross-user access.

## 8. Expected Request Flow

```text
HTTP Request
    |
    v
Route and Middleware
    |
    v
Controller
    |
    v
Service
    |
    v
Repository
    |
    v
MySQL
```

### Routes and middleware

Define endpoints and attach authentication, authorization, validation, and rate-limiting middleware as appropriate.

### Controllers

Validate request structure, invoke services, and translate service results into HTTP responses.

### Services

Enforce business rules, validate state transitions, check ownership, coordinate transactions, and invoke repositories.

### Repositories

Execute controlled SQL queries and return database results.

### MySQL

Persist application records and enforce applicable constraints, indexes, and transactional guarantees.

## 9. Database and Transaction Safety

Production implementations should:

- Use a supported MySQL driver and connection pool.
- Load credentials from secure environment-based configuration.
- Use parameterized queries for all untrusted values.
- Define appropriate primary keys, foreign keys, unique constraints, and indexes.
- Use transactions for operations that must succeed or fail together.
- Use the same database connection for all queries in a transaction.
- Handle deadlocks, connection failures, timeouts, and constraint violations predictably.
- Avoid logging passwords, access tokens, payment credentials, document contents, and unnecessary personal information.
- Use idempotency controls for operations that may be retried.

Payment state changes, subscription updates, application transitions, and document workflows may require transactions or carefully designed compensating actions.

A transaction cannot make an external payment provider or object-storage operation atomic with MySQL. Such workflows need idempotency, retry handling, and reconciliation.

## 10. Error Handling

Repository methods should distinguish expected outcomes from failures.

Examples:

- A record does not exist: return `null` or another documented missing-record result.
- Invalid input: reject with a consistent validation error.
- Duplicate key: translate into a documented conflict where appropriate.
- Database unavailable: propagate a controlled service error.
- Transaction failure: roll back the transaction and preserve the original error.

Never return raw SQL, credentials, connection strings, stack traces, or driver internals in public HTTP responses.

Centralized error middleware should format client-facing errors consistently.

## 11. Testing Requirements

Repository tests should cover:

- Correct SQL and parameter binding.
- SQL-injection resistance.
- Rejection of invalid table and column definitions.
- Search, pagination, sorting, and filtering.
- Unknown-field rejection.
- Missing-record behavior.
- Duplicate records and database constraints.
- Concurrent conditional updates.
- Transaction commit and rollback behavior.
- Database connection failures and timeouts.
- Ownership and cross-user access boundaries at the service/API level.

Use unit tests for isolated repository logic and integration tests against a controlled MySQL environment for real SQL, schema, constraint, and transaction behavior.

Mock-only tests do not establish that production database queries work correctly.

## 12. Production Readiness Checklist

- [ ] Every repository has a corresponding valid model definition.
- [ ] Model definitions match the actual MySQL schema.
- [ ] Required migrations and indexes exist.
- [ ] All untrusted values use parameterized queries.
- [ ] Table and column identifiers use trusted allowlists.
- [ ] Sorting and pagination are validated.
- [ ] Create and update operations enforce field restrictions.
- [ ] Sensitive operations cannot bypass service-level business rules.
- [ ] Ownership and administrative authorization are enforced.
- [ ] Conditional updates protect important state transitions.
- [ ] Required transactions and idempotency controls are implemented.
- [ ] Database errors are handled consistently.
- [ ] Logs do not expose sensitive information.
- [ ] Unit and integration tests cover critical behavior.
- [ ] Production database credentials are configured securely.

## 13. Implementation Status

This document defines the intended repository architecture and expected behavior. It does not certify that every repository, model, database table, migration, or test has been implemented or verified.

Before deployment, validate the actual source files, model definitions, MySQL schema, migration history, repository contracts, service integrations, and test results.

**MedOrbits — Study · Work · Grow**
