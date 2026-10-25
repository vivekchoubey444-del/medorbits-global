MedOrbits — Husky Git Hooks

Directory: .husky/

1. Purpose

The .husky/ directory contains Git hooks managed by Husky for the MedOrbits project. These hooks automate local quality checks, validate commit messages, and optionally enforce tests and build validation before code is pushed.

The hook scripts and installed dependencies determine actual behavior. Keep this documentation synchronized with:

* .husky/pre-commit
* .husky/commit-msg
* .husky/pre-push
* package.json and package-lock.json
* The installed Husky major version
* The GitHub Actions workflows that validate the repository

Local hooks improve consistency but are not a substitute for server-side CI enforcement.

2. Hooks overview

Hook	Purpose	When it runs
pre-commit	Runs configured ESLint checks and optional formatting and tests	Before a commit is created
commit-msg	Validates the first qualifying commit-message line	After the commit message is prepared
pre-push	Runs configured ESLint checks and optional strict validation	Before commits are pushed to a remote

Failure policy: A configured check that fails blocks the operation. Missing optional npm scripts may be skipped with a warning. In strict pre-push mode, the test script is mandatory and must pass.

3. Requirements

* Git installed and the project checked out as a Git repository.
* Node.js and npm versions compatible with the project’s package.json and CI configuration.
* Husky installed and initialized according to the installed version.
* Required project dependencies installed.
* A committed package-lock.json when using npm ci.
* Actual npm scripts configured for any checks that must run.

Check the installed versions:

git —version
node —version
npm —version
npm ls husky —depth=0

If the Husky package is missing, npm ls may return a non-zero exit code. That does not, by itself, mean the rest of the project is invalid.

4. Expected npm scripts

The following table describes scripts referenced by the documented hooks. Verify the hook files and root package.json before relying on this table.

Script	Purpose	Requirement
lint	ESLint validation	Optional in the current hook design
format:check	Prettier formatting validation	Optional
test	Automated tests	Required in strict pre-push mode
build	Production build	Optional in strict pre-push mode
validate:json	JSON validation	Required only when the optional JSON validation mode is enabled in the applicable pre-push script

A script must perform a real validation task. Do not add placeholder scripts that always return success.

5. Setup and installation

Step 1 — Install dependencies

From the repository root:

npm ci

Use npm ci when the committed lockfile matches package.json and you want a reproducible dependency installation.

If the project does not have a lockfile, use the appropriate dependency installation workflow, then review and commit the resulting lockfile when required by project policy.

Step 2 — Install or initialize Husky

If Husky is not installed and the project uses it, install it as a development dependency:

npm install —save-dev husky

For supported Husky versions that use the husky init workflow:

npx husky init

Review any generated changes before proceeding. Preserve the MedOrbits hook scripts and ensure the setup does not replace existing hook logic unexpectedly.

Version compatibility: Husky’s setup commands, hook conventions, and recommended configuration differ between major versions. Follow the official documentation for the version recorded in the project lockfile. Do not blindly copy older initialization commands into a newer installation.

Step 3 — Verify the hook files

Expected project structure:

.husky/
├── README.md
├── pre-commit
├── commit-msg
└── pre-push

Inspect the working tree and configured hooks path:

git status —short
git config —get core.hooksPath

Husky commonly configures Git to use .husky/_ as its hooks directory. The exact path and setup behavior depend on the installed version. Verify that Git actually invokes the intended hooks rather than assuming that the presence of files under .husky/ is sufficient.

Where appropriate for the installed Husky version and environment, set executable permissions:

chmod +x .husky/pre-commit .husky/commit-msg .husky/pre-push

Executable permissions alone do not guarantee that Git will invoke a hook.

6. Commit message convention

The commit-msg hook validates the first non-empty, non-comment line of the commit message, according to the current validator implementation.

General format:

type(scope): short description

The scope is optional.

Supported types

Type	Purpose
feat	New functionality
fix	Bug fixes
docs	Documentation changes
style	Formatting or style-only changes
refactor	Code restructuring
perf	Performance improvements
test	Test-related changes
build	Build system or dependency changes
ci	Continuous integration changes
chore	Maintenance tasks
revert	Reverting earlier changes

Valid examples

feat(auth): add email verification
fix(api): handle missing application ID
docs: update installation guide
chore(deps): update dependencies
feat(api)!: remove deprecated endpoint

The ! marker indicates a breaking change.

Validation rules

According to the current documented validator, the first qualifying line must have:

* A supported commit type.
* An optional, non-empty scope using permitted characters.
* A colon followed by a single space.
* A non-empty description.
* A subject length within the validator’s 100-character limit.

The precise rules are determined by the regular expression and length-checking logic in the committed validator. If those rules change, update this section and test both accepted and rejected examples.

The validator does not necessarily inspect the complete commit body or enforce every aspect of the Conventional Commits specification.

7. Hook behavior

Pre-commit

The .husky/pre-commit hook:

1. Locates the Git repository root.
2. Verifies that package.json, Node.js, and npm are available.
3. Runs npm run lint if the lint script is configured.
4. Reports a warning if the optional lint script is absent.
5. Runs formatting validation and tests when MEDORBITS_PRECOMMIT_FULL=1.
6. Blocks the commit if a configured check fails.

Run lightweight checks through the hook:

git commit -m “feat: improve validation”

Enable full pre-commit checks for a single command in a compatible POSIX shell:

MEDORBITS_PRECOMMIT_FULL=1 git commit -m “feat: improve validation”

The environment variable applies to that command and its child processes. It does not permanently enable full mode.

Commit message

The .husky/commit-msg hook:

1. Receives the path to the prepared commit-message file.
2. Validates that the file can be inspected.
3. Finds the first non-empty, non-comment line.
4. Validates the line against the supported commit-message pattern.
5. Rejects a message that does not satisfy the configured rules.

Test the validator directly only if its command-line interface supports direct invocation. The exact arguments and validation behavior must match the committed script.

Pre-push

The .husky/pre-push hook:

1. Locates the Git repository root.
2. Verifies the required project files and tools.
3. Validates package.json.
4. Runs ESLint when the lint script is configured.
5. Reports a warning if that optional script is missing.
6. In strict mode, requires the test script and runs it.
7. Runs formatting and build checks in strict mode when those scripts are configured.
8. Blocks the push when a configured check fails.

Enable strict pre-push validation for one push:

MEDORBITS_PREPUSH_FULL=1 git push

If the installed pre-push script supports optional JSON validation, enable it with:

MEDORBITS_PREPUSH_JSON=1 git push

Combine both modes when required:

MEDORBITS_PREPUSH_FULL=1 MEDORBITS_PREPUSH_JSON=1 git push

The JSON-validation option requires the corresponding implementation in the committed hook and a real validate:json npm script. Do not assume it exists solely because it is documented here.

Without strict mode, automated tests and production-build checks are not mandatory in the documented pre-push design.

8. Run checks manually

Run individual commands only when the corresponding scripts are configured:

npm run
npm run lint
npm run format:check
npm test
npm run build

If a script is absent, npm will report that it cannot find the requested script. This is expected until the script is implemented and added to package.json.

Illustrative package configuration

The following is an example, not a claim about the current MedOrbits configuration:

{
  “scripts”: {
    “lint”: “eslint .”,
    “format:check”: “prettier —check .”,
    “test”: “node —test”,
    “build”: “node scripts/build.js”
  }
}

Adapt each command to the actual dependencies, configuration files, test framework, build process, and project structure. For example, node —test is appropriate only when the project uses Node.js’s built-in test runner and has tests compatible with it.

Before making a script mandatory:

1. Confirm its dependencies are installed.
2. Confirm it checks the intended files.
3. Confirm it returns a non-zero exit code on failure.
4. Run it locally.
5. Run it in CI using the supported Node.js version.

9. Troubleshooting

A hook does not run

* Confirm Husky is installed and configured.
* Check the hook filename and location.
* Inspect the Git hooks path:

git config —get core.hooksPath

* Verify the installed Husky version and its setup requirements.
* Check for shell syntax errors, invalid quotation marks, or incorrect line endings.
* Confirm hooks have not been disabled or bypassed in the local environment.

A commit is rejected

Read the hook output, correct the reported problem, and retry.

For a commit-message rejection, check the type, optional scope, colon and space, description, subject length, and pattern defined in .husky/commit-msg.

A push is rejected

Run the relevant checks manually:

npm run lint
npm test

If strict mode reports that the test script is missing, configure a real test command in package.json and verify that it passes before pushing again.

If formatting or build validation fails, correct the underlying issue rather than bypassing the hook.

A check is skipped

Inspect the available scripts:

npm run

A missing optional script may explain the warning. If the check is important to project quality, implement it and enforce it through CI.

Dependencies are missing

Install the locked dependencies:

npm ci

If installation fails, inspect the npm output, lockfile consistency, registry configuration, and supported Node.js version before retrying.

10. GitHub Actions and branch protection

Local Git hooks are developer-side safeguards. They can be bypassed and do not establish that a remote branch satisfies repository policy.

For reliable enforcement:

* Run required lint, formatting, test, and build checks in GitHub Actions.
* Require successful status checks before merging into protected branches.
* Require pull requests and reviews where appropriate.
* Use the supported Node.js version and committed lockfile in CI.
* Keep the local hooks and CI checks aligned.
* Enforce authorization, validation, and security-sensitive requirements on the server side.
* Review workflow permissions and third-party actions before granting write access.

A local hook passing is not proof that the pushed revision will pass CI. The CI workflow must validate the revision being built.

11. Security guidelines

* Never commit passwords, API keys, access tokens, or other secrets in hook files.
* Avoid printing sensitive environment variables in command output.
* Do not disable authorization, validation, or security tests just to make a hook pass.
* Keep hook changes version-controlled and reviewed.
* Treat local hooks as convenience checks, not a security boundary.
* Use server-side validation and CI for policies that must not be bypassed.

12. Maintenance checklist

When hook behavior changes:

1. Update the affected hook script.
2. Update this README to match actual behavior.
3. Verify the relevant npm scripts in package.json.
4. Check dependency and lockfile consistency.
5. Test successful and failing hook scenarios.
6. Confirm commit-message examples match the actual validator.
7. Test standard and strict modes.
8. Run the relevant GitHub Actions workflows.
9. Review the final changes before merging.

Final notes

* The committed hook scripts determine actual behavior.
* Optional checks may be skipped when their npm scripts are absent.
* Automated tests are required before pushing only when strict pre-push mode is enabled.
* Husky setup and hook conventions depend on the installed version.
* GitHub Actions and branch protection should enforce important repository policies.

Maintenance principle: Keep MedOrbits Git hooks consistent, predictable, efficient, and aligned with continuous integration.