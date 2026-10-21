MedOrbits — Husky Git Hooks

Directory: .husky/

Purpose

This directory contains Git hooks managed by Husky for the MedOrbits project. The hooks automate local code-quality checks, validate commit messages, and run automated tests before code is pushed to a remote repository.

The hook scripts determine actual behavior. Keep this README synchronized with the committed scripts, package.json, and installed Husky version.

Hooks Overview

File	Purpose	When it runs
pre-commit	Runs ESLint when configured. Optional formatting and tests can run in full mode.	Before a commit is created
commit-msg	Validates the first non-empty, non-comment line against the supported Conventional Commit format.	After the commit message is prepared
pre-push	Runs ESLint when configured. Strict mode requires the test script and runs optional formatting and build checks.	Before pushing commits to a remote

Important: Missing optional npm scripts may be skipped with warnings. A configured check that fails should block the operation. In strict pre-push mode, the test script must exist and pass.

Requirements

* Git installed and the project checked out as a Git repository.
* Node.js meeting the version specified by MedOrbits.
* npm compatible with the project.
* A committed package-lock.json when using npm ci.
* Husky installed and configured for the project’s version.
* Required project dependencies installed.

Expected npm scripts

Script	Purpose	Requirement
lint	ESLint validation	Optional in the current hooks
format:check	Prettier formatting validation	Optional
test	Automated tests	Required in strict pre-push mode
build	Production build	Optional in strict pre-push mode

The actual scripts must be defined in the root package.json and must perform real checks.

Setup

1. Install project dependencies

From the repository root, run:

npm ci

Use npm install if the project does not have a committed lockfile or if you intentionally need to update dependencies.

2. Install or initialize Husky

If Husky is not already installed, add it as a development dependency:

npm install —save-dev husky

Initialize Husky using the procedure supported by the installed version:

npx husky init

Review any generated files. Preserve the existing MedOrbits hook scripts and verify that Husky executes them correctly.

Husky setup commands and hook conventions vary by major version. Follow the documentation for the installed version rather than replacing existing configuration blindly.

3. Verify the hook files

Expected structure:

.husky/
├── README.md
├── pre-commit
├── commit-msg
└── pre-push

Inspect the Git working tree and configured hooks path:

git status —short
git config —get core.hooksPath

Where required by the installed Husky version and environment, ensure the hook files have executable permissions:

chmod +x .husky/pre-commit .husky/commit-msg .husky/pre-push

Executable permissions alone do not guarantee that Git invokes the hooks. Verify the hooks path and Husky configuration as well.

Commit Message Convention

The commit-msg hook validates the first non-empty, non-comment line of the commit message.

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

Examples

feat(auth): add email verification
fix(api): handle missing application ID
docs: update installation guide
chore(deps): update dependencies
feat(api)!: remove deprecated endpoint

The ! marker indicates a breaking change.

Validation rules

The current validator requires:

* A supported commit type.
* An optional, non-empty scope using permitted characters.
* A colon followed by a single space.
* A non-empty description.
* A description of 1–100 characters under the current regular expression.

The validator checks only the first qualifying line, not the entire commit body. Confirm any changes to the regular expression in .husky/commit-msg.

Running Checks Manually

Run only commands whose scripts exist in package.json:

npm run lint
npm run format:check
npm test
npm run build

Inspect the available scripts with:

npm run

Hook Behavior

Pre-commit

The .husky/pre-commit hook:

1. Locates the repository root.
2. Verifies package.json, Node.js, and npm.
3. Runs npm run lint if the lint script exists.
4. Skips linting with a warning if the script is missing.
5. Runs formatting validation and tests only when MEDORBITS_PRECOMMIT_FULL=1.
6. Blocks the commit if a configured check fails.

Enable full local pre-commit checks in a compatible shell with:

MEDORBITS_PRECOMMIT_FULL=1 git commit

This environment variable enables the optional checks for that command only.

Commit message

The .husky/commit-msg hook:

1. Verifies that a commit-message file is supplied.
2. Reads the first non-empty, non-comment line.
3. Validates the line against the supported Conventional Commit pattern.
4. Rejects messages that do not match.

Pre-push

The .husky/pre-push hook:

1. Locates the repository root.
2. Verifies the required project files and tools.
3. Runs ESLint when lint is configured.
4. Skips ESLint with a warning if that script is missing.
5. In strict mode, requires the test script and runs it.
6. Runs formatting and build checks in strict mode when those scripts are configured.
7. Blocks the push when a configured check fails.

Enable strict pre-push checks in a compatible shell with:

MEDORBITS_PREPUSH_FULL=1 git push

Without strict mode, the hook does not require automated tests or a production build.

Package Scripts

The following is an illustrative configuration, not a claim about the current MedOrbits package.json:

{
  “scripts”: {
    “lint”: “eslint .”,
    “format:check”: “prettier —check .”,
    “test”: “node —test”,
    “build”: “node scripts/build.js”
  }
}

Adapt the commands to the actual dependencies, ESLint configuration, Prettier configuration, test framework, build process, and project structure.

Do not add placeholder commands that report success without performing real checks. Verify every script locally and in CI before making it mandatory.

Troubleshooting

A hook does not run

* Confirm Husky is installed and configured.
* Verify the hook filename and location under .husky/.
* Check the configured Git hooks path.
* Review initialization instructions for the installed Husky version.
* Inspect the hook for shell syntax errors or invalid quotation marks.
* Confirm hooks have not been disabled or bypassed in the local environment.

A commit is rejected

Read the hook output, correct the reported issue, and retry.

For commit-message rejection, verify the type, optional scope, colon and space, description length, and formatting against .husky/commit-msg.

A push is rejected

Run the applicable checks locally:

npm run lint
npm test

If strict mode reports that the test script is missing, configure a real test command in package.json before pushing.

A check is skipped

Inspect the available scripts:

npm run

A missing optional script may explain the warning. If a check is important to project quality, configure it and enforce it in CI.

Dependencies are missing

Install the locked dependencies:

npm ci

If installation fails, inspect the npm output, lockfile, registry configuration, and supported Node.js version before retrying.

GitHub Actions and Branch Protection

Local Git hooks improve development practices, but they are not a security boundary and can be bypassed.

For stronger enforcement:

* Run linting, formatting validation, and automated tests in GitHub Actions.
* Configure required status checks for protected branches.
* Require pull requests and reviews where appropriate.
* Use the supported Node.js version and lockfile in CI.
* Keep local checks and CI checks aligned.
* Enforce security-sensitive policies on the server rather than relying on local hooks.

Security Guidelines

* Never store passwords, API keys, access tokens, or other secrets in hook files.
* Avoid printing sensitive environment variables in command output.
* Do not disable authorization, validation, or security tests merely to make a hook pass.
* Keep hook changes version-controlled and reviewed.
* Use server-side validation and CI for policies that must not be bypassed locally.

Maintenance Checklist

When hook behavior changes:

1. Update the affected hook script.
2. Update this README.
3. Verify the relevant npm scripts in package.json.
4. Test both successful and failing hook scenarios.
5. Confirm commit-message examples match the actual validator.
6. Run the checks locally and in GitHub Actions.
7. Review the changes before merging.

Final Notes

* The hook scripts, not this README, determine actual behavior.
* Optional scripts may be skipped by the current hooks.
* Automated tests are required before pushing only when strict pre-push mode is enabled.
* Husky initialization and hook conventions depend on the installed version.
* CI and branch protection should enforce important repository policies.

Maintenance principle: Keep MedOrbits Git hooks consistent, predictable, and efficient while enforcing critical quality checks through continuous integration.