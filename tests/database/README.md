MedOrbits Database Tests

1. Purpose

The tests/database/ directory contains automated tests and shared utilities for verifying MedOrbits database connectivity, repository operations, schema constraints, indexes, migrations, and transaction behavior.

The suite is intended to detect:

* Database connection and configuration failures.
* Repository CRUD and query-handling defects.
* Missing or ineffective database constraints.
* Missing indexes and incorrect index behavior.
* Migration naming and migration-history inconsistencies.
* Transaction commit, rollback, and atomicity failures.
* Unsafe database test configuration.
* Data integrity issues and inconsistent database behavior.

Security requirement: Database tests must run only against a dedicated test database. Never use production credentials or a production database.

2. Directory structure

tests/
└── database/
    ├── setup.js
    ├── connection.test.js
    ├── constraints.test.js
    ├── indexes.test.js
    ├── migrations.test.js
    ├── repositories.test.js
    ├── transactions.test.js
    └── README.md

File responsibilities

File	Responsibility
setup.js	Shared MySQL connection, configuration validation, and lifecycle helpers
connection.test.js	Connectivity, database identity, and connection configuration
constraints.test.js	Primary keys, unique constraints, required fields, and referential integrity
indexes.test.js	Index metadata, uniqueness, and indexed query behavior
migrations.test.js	Migration naming, history, and tracking checks
repositories.test.js	Repository-style CRUD operations and parameterized queries
transactions.test.js	Transaction commit, rollback, atomicity, and isolation
README.md	Database testing setup, execution, safety, and maintenance

Each test file should have a clearly defined responsibility and avoid unnecessary duplication.

3. Requirements

* Node.js 20 or later.
* A MySQL-compatible test database.
* The mysql2 package.
* A dedicated test database with a clearly identifiable test name.
* Database credentials with only the privileges required by the tests.
* The project migration runner and repository modules where application integration is required.

Install the driver if it is not already installed:

npm install mysql2

Use the project’s existing test runner consistently. The examples below use Node.js’s built-in test runner (node:test).

4. Environment configuration

The shared module tests/database/setup.js uses these environment variables.

Variable	Required	Description
NODE_ENV	Yes	Must be test
TEST_DATABASE_URL	Yes	MySQL URL for the dedicated test database
MIGRATIONS_DIR	For migration tests	Migration directory when different from the configured default
MIGRATIONS_TABLE	Optional	Migration history table when different from migrations

Example URL:

mysql://test_user:test_password@127.0.0.1:3306/medorbits_test

Configure your local environment:

export NODE_ENV=test
export TEST_DATABASE_URL=‘mysql://test_user:test_password@127.0.0.1:3306/medorbits_test’

For credentials containing reserved URL characters, percent-encode the username and password.

Never commit actual database credentials to source control. Use local environment variables or a CI secret manager.

Database safety requirements

1. Set NODE_ENV=test.
2. Use a dedicated, disposable test database.
3. Ensure the database name contains a clear test marker, such as medorbits_test.
4. Never point TEST_DATABASE_URL at production.
5. Do not print database credentials in logs.
6. Use a restricted database account rather than an administrative account.
7. Review tests that create, modify, truncate, or drop database objects.
8. Confirm the database target before running destructive integration tests.

Configuration validation reduces risk but cannot prove that a database is disposable. Verify the target and credentials independently.

5. Shared database setup

Import the shared utilities from setup.js:

‘use strict’;
const {
  connectTestDatabase,
  getTestDatabaseConnection,
  closeTestDatabase,
} = require(‘./setup’);

Example using Node.js’s built-in test runner

‘use strict’;
const assert = require(‘node:assert/strict’);
const { before, after, test } = require(‘node:test’);
const {
  connectTestDatabase,
  getTestDatabaseConnection,
  closeTestDatabase,
} = require(‘./setup’);
before(async () => {
  await connectTestDatabase();
});
after(async () => {
  await closeTestDatabase();
});
test(‘test database connection is available’, () => {
  const connection = getTestDatabaseConnection();
  assert.ok(connection);
});

This example verifies that a shared connection is available. It does not verify repository behavior, schema correctness, or transaction semantics.

Lifecycle requirements

* Connect before database-dependent tests execute.
* Close the shared connection after the suite completes.
* Ensure cleanup executes even when a test fails.
* Do not register Jest lifecycle hooks in a node:test suite.
* Do not close a shared connection while other tests are using it.
* Isolate tests that require independent connections or concurrent transactions.
* Avoid closing a shared connection from individual test files when setup.js owns its lifecycle.

For concurrent execution, use appropriately isolated connections, schemas, or test databases.

6. Running the tests

Run all database tests

NODE_ENV=test \
TEST_DATABASE_URL=“$TEST_DATABASE_URL” \
node —test tests/database/*.test.js

This command assumes all test files use Node.js’s built-in test runner and the shared configuration.

If the URL is not already exported, supply the dedicated test database URL explicitly:

NODE_ENV=test \
TEST_DATABASE_URL=‘mysql://test_user:test_password@127.0.0.1:3306/medorbits_test’ \
node —test tests/database/*.test.js

Do not use real credentials in shared terminal logs, screenshots, documentation, or commits.

Run individual test files

Connection tests:

NODE_ENV=test TEST_DATABASE_URL=“$TEST_DATABASE_URL” \
node —test tests/database/connection.test.js

Constraint tests:

NODE_ENV=test TEST_DATABASE_URL=“$TEST_DATABASE_URL” \
node —test tests/database/constraints.test.js

Index tests:

NODE_ENV=test TEST_DATABASE_URL=“$TEST_DATABASE_URL” \
node —test tests/database/indexes.test.js

Migration tests:

NODE_ENV=test TEST_DATABASE_URL=“$TEST_DATABASE_URL” \
node —test tests/database/migrations.test.js

Repository tests:

NODE_ENV=test TEST_DATABASE_URL=“$TEST_DATABASE_URL” \
node —test tests/database/repositories.test.js

Transaction tests:

NODE_ENV=test TEST_DATABASE_URL=“$TEST_DATABASE_URL” \
node —test tests/database/transactions.test.js

Add an npm script

Merge this entry into the existing scripts object in package.json. Do not replace existing scripts.

{
  “scripts”: {
    “test:database”: “node —test tests/database/*.test.js”
  }
}

If package.json already contains a scripts object, add only the test:database property to it.

Run the suite:

NODE_ENV=test \
TEST_DATABASE_URL=“$TEST_DATABASE_URL” \
npm run test:database

7. Test responsibilities

7.1 Connection tests

Verify that:

* The configured test database can be reached.
* Missing or invalid configuration fails clearly.
* The connected database matches the expected database.
* Connection cleanup works after tests complete.
* Connection errors are handled without exposing credentials.
* Connection setup does not silently connect to an unintended database.

7.2 Constraint tests

Verify applicable database rules:

* Primary-key uniqueness.
* Unique email addresses or other business identifiers.
* Required fields and NOT NULL constraints.
* Foreign-key relationships.
* Valid values for constrained fields.
* Referential integrity when records are updated or deleted.
* Rollback behavior where relevant.

Test actual database constraints rather than relying exclusively on application-level validation.

7.3 Index tests

Verify that:

* Required indexes exist.
* Unique indexes reject duplicate values.
* Composite indexes have the intended column order.
* Indexed queries return correct results.
* Database-specific index metadata can be inspected.
* Index definitions are consistent with the schema.

An index existing does not prove that the database uses it for a particular query. Query-plan assertions should be separate, database-specific tests.

7.4 Migration tests

Verify that:

* Migration files follow the project’s naming convention.
* Migration versions are unique.
* Migration history is readable.
* Recorded versions follow the project’s migration policy.
* Applying pending migrations produces the expected schema.
* Re-running the migration runner does not reapply completed migrations.
* Rollback behavior is tested where the migration system supports down migrations.

Migration execution and rollback tests must use a disposable database or isolated schema.

Important: Filename and migration-history checks alone do not prove that migrations execute correctly. Integration tests should invoke the actual MedOrbits migration runner.

7.5 Repository tests

Verify that:

* Records can be created and retrieved.
* Missing records produce predictable results.
* Updates affect only intended fields.
* Deletions follow the repository contract.
* Database uniqueness and other constraints are enforced.
* Queries use parameterized values.
* Transactions and foreign-key relationships are respected.
* Repository methods handle database errors consistently.

Repository tests should import the actual MedOrbits repository modules. Standalone SQL examples do not establish that production repository implementations are correct.

7.6 Transaction tests

The transactions.test.js suite should verify actual transaction behavior and, when available, the production transaction wrapper.

Commit behavior

* Successful transactions commit all intended changes.
* Committed records are visible to subsequent transactions according to the configured isolation level.
* A transaction does not report success before its commit succeeds.

Rollback behavior

* Failed transactions roll back their changes.
* Partial writes are not persisted after a transaction fails.
* Errors during transactional operations are propagated correctly.
* Rollback failures are handled without hiding the original failure.

Atomicity and consistency

* Related database changes succeed or fail together.
* Database constraints remain enforced within transactions.
* Failed operations do not leave partially updated business records.
* Payment, application, subscription, and other multi-step operations preserve their required invariants.

Connection handling

* All statements within a transaction use the same connection.
* Connections are released after commit or rollback.
* Exceptions do not leave transactions open.
* A failed transaction does not leave a connection in an unsafe state.

Concurrency and isolation

* Concurrent transactions do not produce unintended lost updates.
* Locking and isolation behavior match the database engine’s requirements.
* Deadlocks and serialization failures follow the application’s retry policy.
* Nested transactions follow the documented strategy, such as savepoints or explicit rejection.

Use isolated records, temporary tables, or a dedicated test schema. A concurrency test requires separate database connections; requesting the same shared connection twice is not sufficient.

A rollback test must verify database state after rollback, not merely assert that an exception was thrown.

8. Migration and schema consistency

MedOrbits should maintain one authoritative database schema strategy.

Document:

* The database engine and supported versions.
* The migration tool or runner.
* The location of migration files.
* The migration versioning convention.
* The migration history table.
* The process for applying migrations in development, test, staging, and production.
* Whether rollback is supported.
* How schema changes are reviewed.
* How backups and recovery are handled.

Do not independently create or modify production tables from test setup code.

Database tests should use the intended test schema or temporary database objects and must not conflict with production schema management.

9. Cleanup and test isolation

Every test must clean up records and temporary database objects that it creates.

Recommended practices:

* Generate unique identifiers for test records.
* Use transactions and rollback when safe and appropriate.
* Use isolated temporary tables or schemas for metadata tests.
* Prevent concurrent tests from modifying the same fixtures.
* Never assume auto-increment IDs begin at 1.
* Close connections even when a test fails.
* Use teardown hooks and finally blocks for cleanup.
* Ensure every transaction is committed or rolled back.
* Release database connections after transaction completion.
* Avoid dropping shared application tables during routine test cleanup.
* Ensure parallel CI jobs use isolated databases or schemas.

If multiple suites execute concurrently, use independent test databases, schemas, or carefully isolated fixtures.

10. CI integration

A CI pipeline should:

1. Start a disposable MySQL service.
2. Create a dedicated test database and restricted test account.
3. Install project dependencies.
4. Configure test environment variables using CI secrets where necessary.
5. Apply the intended test schema and migrations.
6. Run the database tests.
7. Capture test output and failure reports without exposing credentials.
8. Destroy the disposable database after the job completes.

Do not run destructive database tests against a shared staging or production database.

CI should fail when a required database test fails. Do not silently skip mandatory tests when the configured environment is expected to support them.

11. Troubleshooting

Problem	Likely cause	Recommended action
TEST_DATABASE_URL is required	Environment variable is missing	Configure the dedicated test database URL
Database-name validation fails	Database name lacks a test marker	Use a name such as medorbits_test
Authentication failure	Incorrect credentials or database grants	Verify the restricted test account
Connection timeout	MySQL is unavailable or inaccessible	Check service status, hostname, port, and network access
Migration directory missing	Incorrect migration path	Set MIGRATIONS_DIR to the actual directory
Migration history table missing	Migration bootstrap has not run	Initialize the migration system in the test database
Duplicate-key error	A fixture reused a unique value	Generate unique test identifiers
Transaction changes remain after failure	Rollback was not executed or was ineffective	Inspect the transaction wrapper and verify database state
Connection remains busy after a test	A transaction or connection was not released	Add reliable rollback and teardown handling
Concurrent tests interfere	Shared fixtures or DDL operations	Isolate records, schemas, or databases
Rollback test fails	Transaction logic or storage engine is unsuitable	Review rollback behavior and confirm transactional tables use InnoDB

12. Completion checklist

The database test suite is ready for CI when:

* [ ]	The test database is explicitly configured and isolated.
* [ ]	Connection setup and teardown are reliable.
* [ ]	Database tests cannot run accidentally under NODE_ENV=production.
* [ ]	Schema constraints are tested against the real schema.
* [ ]	Required indexes and their definitions are verified.
* [ ]	Migration tests invoke the actual migration runner.
* [ ]	Repository tests exercise the actual MedOrbits repository modules.
* [ ]	Transaction tests verify commit, rollback, atomicity, and connection cleanup.
* [ ]	Concurrency and isolation tests cover critical transactional workflows.
* [ ]	Test data is isolated and cleaned up.
* [ ]	Failures identify the relevant operation without exposing secrets.
* [ ]	Tests pass against the database engine and version used by the project.

13. Maintenance policy

Update this documentation and the corresponding tests whenever MedOrbits changes:

* Database engine or driver.
* Database schema or constraints.
* Migration tool or versioning strategy.
* Repository interfaces or query behavior.
* Transaction wrappers or isolation requirements.
* Test runner or CI configuration.
* Database connection and credential management.

Final rule: Keep database tests isolated, repeatable, and aligned with the real MedOrbits implementation. Never treat an illustrative test or a skipped assertion as proof that the production database layer is correct.