MedOrbits — Husky Git Hooks

Directory: .husky/
Purpose: Local development safeguards, commit-message validation, and pre-push quality checks
Scope: Developer workstation and repository workflow
Enforcement boundary: Local hooks are advisory safeguards; GitHub Actions and repository rules provide remote enforcement.

⸻

1. Overview

MedOrbits uses Git hooks to catch common quality issues before changes are committed or pushed. The hooks can validate code, enforce commit-message conventions, and run additional checks when explicitly enabled.

The intended workflow is:

1. Pre-commit: Run lightweight checks before creating a commit.
2. Commit-msg: Validate the commit subject after Git prepares the message.
3. Pre-push: Validate the proposed push before Git sends it to the remote.
4. Continuous integration: Revalidate the pushed or proposed changes independently of local hooks.

The committed scripts are the source of truth for hook behavior. This README describes the intended contract and must be updated whenever the implementation, configuration, dependencies, or CI policies change.

Design principles

* Fail clearly: A configured check that fails must block the associated Git operation.
* Stay efficient: Keep routine commits reasonably fast; reserve expensive checks for explicit full-validation modes or CI.
* Avoid false assurances: Missing optional scripts must never be presented as successfully executed checks.
* Remain reproducible: Use the supported Node.js version and lockfile.
* Keep enforcement consistent: Important quality requirements must also run in CI.
* Preserve security: Do not bypass validation to conceal a real defect.

2. Directory structure

Expected layout:

.husky/
├── README.md
├── pre-commit
├── commit-msg
└── pre-push
.github/
└── workflows/
    ├── ci.yml                 # Example name; verify actual workflow
    └── ...                    # Other repository workflows
.github/
└── scripts/
    └── validate-commit-message.sh  # If this is the configured validator
package.json
package-lock.json

This is a reference layout, not a claim that every file already exists. Confirm the actual repository structure before adding or renaming files.

Hook responsibilities

Hook	Trigger	Primary responsibility
pre-commit	Before a commit is created	Fast local code-quality checks
commit-msg	After the commit message is prepared	Validate the commit subject
pre-push	Before a push is sent	Validate the proposed push
GitHub Actions	On configured repository events	Independent CI enforcement

A hook’s presence does not prove that Git invokes it. Husky installation, the configured Git hooks path, executable permissions, and the installed Husky version all affect execution.

3. Requirements and compatibility

Required tools depend on the checks enabled by the repository.

* Git
* Node.js version supported by package.json, the lockfile, and CI
* npm version compatible with the project
* Husky installed as a project dependency
* Installed project dependencies
* A consistent package.json and package-lock.json when using npm ci
* Real npm scripts for every required validation task

Check the environment from the repository root:

git —version
node —version
npm —version
npm ls husky —depth=0
npm run

npm ls husky —depth=0 can exit non-zero when Husky is absent or the dependency tree is inconsistent. Investigate the result rather than treating the exit code alone as proof of a broader project failure.

Husky version policy

Husky setup commands and configuration conventions differ between major versions. Use the documentation matching the version recorded in package-lock.json.

Do not blindly combine legacy Husky initialization instructions with newer hook conventions. In particular, avoid adding deprecated bootstrap lines simply because they appear in an older example.

4. Installation and setup

Step 1 — Install locked dependencies

npm ci

Use npm ci when the project commits a valid lockfile and reproducible installation is required.

If installation fails, investigate lockfile consistency, registry access, platform-specific dependencies, and the supported Node.js version. Do not immediately delete the lockfile or force dependency upgrades.

Step 2 — Verify Husky installation

npm ls husky —depth=0

If Husky is missing and the project intends to use it, install the version approved for the repository:

npm install —save-dev husky

Then follow the setup instructions for that installed major version. For versions supporting the init workflow:

npx husky init

Review all generated changes. Initialization must not silently replace existing MedOrbits hook logic or change npm scripts without review.

Step 3 — Verify Git’s configured hooks path

git config —get core.hooksPath

Husky commonly configures Git to use .husky/_ as its internal hooks directory. The exact setup varies by version.

If the command returns no value, inspect the installed Husky version and initialization process before assuming hooks are active.

Also inspect repository status:

git status —short

Step 4 — Verify the hook files

ls -la .husky/

Where appropriate for the installed Husky version and operating system:

chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
chmod +x .husky/pre-push

Executable permissions alone do not guarantee that Git invokes the hooks. Validate actual execution with a controlled test commit and push.

5. Expected npm script contract

The following table describes the intended script interface. Check the root package.json before relying on any script.

Script	Intended purpose	Policy
lint	ESLint validation	Optional in the documented lightweight hook design
format:check	Formatting validation	Optional unless required by repository policy
test	Automated tests	Mandatory in strict pre-push mode
build	Production build	Optional in strict mode unless explicitly made mandatory
validate:json	JSON syntax/schema checks	Required when JSON validation mode is enabled

Script integrity requirements

A script should:

* Execute a real validation task.
* Exit with status 0 only when its checks pass.
* Return a non-zero status when validation fails.
* Avoid silently skipping the intended target files.
* Use dependencies declared by the project.
* Work in the Node.js environment used by CI.

Do not add placeholder commands that always succeed to satisfy a hook.

Inspect available scripts

npm run

Run configured checks individually:

npm run lint
npm run format:check
npm test
npm run build
npm run validate:json

These commands are examples of the intended interface. If a script is not configured, npm will report that it is unavailable. Do not interpret an absent script as a successful check.

6. Commit-message conventions

The commit-msg hook validates the first non-empty, non-comment line of the prepared commit message, subject to the actual implementation of the configured validator.

Required format

type(scope): description
type: description
type(scope)!: description
type!: description

The scope and breaking-change marker are optional.

Supported types

Type	Intended use
feat	Add a user-facing or internal feature
fix	Correct a defect
docs	Documentation changes
style	Formatting or style-only changes
refactor	Restructure code without intended behavior changes
perf	Improve performance
test	Add or update tests
build	Build system or dependency changes
ci	Continuous integration changes
chore	Maintenance tasks
revert	Revert an earlier change

Valid examples

feat(auth): add email verification
fix(api): handle missing application ID
docs: update installation guide
test(admin): cover unauthorized access
build(deps): update approved dependencies
ci: validate supported Node.js versions
chore(deps): refresh lockfile
feat(api)!: remove deprecated endpoint
revert: restore previous application validation

Breaking changes

The ! marker indicates that a change is breaking:

feat(api)!: remove deprecated endpoint

A subject marker does not automatically guarantee that the full commit body or footer follows every Conventional Commits requirement. If the project requires a BREAKING CHANGE: footer, issue references, or body formatting, implement and test those rules separately.

Subject validation rules

The documented validator is intended to enforce:

* A supported, lowercase commit type.
* An optional, non-empty scope using permitted characters.
* A colon followed by exactly one ordinary space.
* A non-empty description.
* A description beginning with a non-whitespace character.
* A maximum subject length of 100 characters by default.
* No leading or trailing subject whitespace.

The exact regular expression, character-counting behavior, and handling of comments or line endings are determined by the committed validator.

Invalid examples

Feature(auth): add email verification
feat(auth):  add email verification
feat(): add email verification
feat(auth) add email verification
feat(auth):
unknown: update validation

The first example uses an unsupported type. The second has two spaces after the colon. The remaining examples violate the expected scope, separator, or description format.

Character limit

The default limit is 100 characters in the documented validator.

If the implementation supports a configurable maximum, the limit can be overridden using the exact environment variable accepted by that script. For example, if MAX_SUBJECT_LENGTH is implemented:

MAX_SUBJECT_LENGTH=120 .github/scripts/validate-commit-message.sh .git/COMMIT_EDITMSG

Do not assume this override works until the committed script implements it. Keep the README, validator, tests, and CI behavior synchronized.

7. Pre-commit hook

File: .husky/pre-commit

The intended lightweight workflow is:

1. Identify the repository root.
2. Verify that required project files and tools are available.
3. Run npm run lint if the script is configured.
4. Clearly warn if an optional lint script is missing.
5. Run additional formatting and test checks when full mode is enabled.
6. Stop the commit if an executed check fails.

Normal mode

git commit -m “feat: improve validation”

Full pre-commit mode

If implemented by the committed hook:

MEDORBITS_PRECOMMIT_FULL=1 git commit -m “feat: improve validation”

The variable applies to the command and its child processes. It does not permanently change the environment.

Full mode should only be considered successful when every check required by the implementation has passed. If formatting or testing is not configured, the hook must communicate the omission clearly.

Recommended scope

Keep the default pre-commit checks fast. Run the full test suite or production build locally when needed, and always enforce required checks in CI.

For repositories that require changes to pass linting before staging or committing, consider staged-file linting rather than linting the entire repository on every commit. Adopt this only when the project has a suitable, tested implementation.

8. Commit-msg hook

File: .husky/commit-msg

The intended workflow is:

1. Accept the commit-message file path supplied by Git.
2. Verify that the file exists and is readable.
3. Locate the first non-empty, non-comment subject line.
4. Validate the subject against the approved convention.
5. Return a non-zero exit status for an invalid message.

Manual verification

Run the validator directly only when the repository’s configured validator supports standalone invocation.

For a validator that accepts a message-file path:

.github/scripts/validate-commit-message.sh /path/to/commit-message.txt

Create a temporary message file containing a valid subject and another containing an invalid subject to test both outcomes. Avoid modifying the actual Git commit message file during manual testing.

Expected behavior

Input	Expected outcome
Valid supported type and description	Pass
Unsupported type	Fail
Missing colon or required space	Fail
Empty scope	Fail
Empty description	Fail
Subject above the configured maximum	Fail
Empty or comment-only message	Fail

These outcomes must be confirmed against the committed validator and its tests.

9. Pre-push hook

File: .husky/pre-push

The intended workflow is:

1. Identify the repository root.
2. Verify required files and tools.
3. Validate the root package.json.
4. Run linting if configured.
5. Warn when optional scripts are absent.
6. In strict mode, require and execute the test script.
7. Execute configured formatting and build checks in strict mode.
8. Run JSON validation when the optional JSON-validation mode is implemented and enabled.
9. Block the push if a required or executed check fails.

Standard mode

git push

Strict mode

If supported by the committed hook:

MEDORBITS_PREPUSH_FULL=1 git push

Strict mode should require a real test script. A missing required script must block the push rather than being silently skipped.

Formatting and build validation may remain optional in strict mode only if the implementation and repository policy explicitly permit that behavior. If either is mandatory for MedOrbits, make it mandatory in both the hook and CI.

Optional JSON validation

If the hook supports the relevant environment variable and validate:json is implemented:

MEDORBITS_PREPUSH_JSON=1 git push

To combine both modes:

MEDORBITS_PREPUSH_FULL=1 MEDORBITS_PREPUSH_JSON=1 git push

The JSON-validation mode must invoke a real validator. Do not infer support from this documentation alone.

What pre-push does not guarantee

A successful pre-push hook does not prove that:

* The remote branch has no conflicts.
* The pushed changes will pass CI.
* All required tests were executed if they are optional in the current mode.
* The server will accept the push.
* Repository branch protection requirements have been satisfied.

Remote policy and CI remain authoritative.

10. Recommended verification matrix

Use this matrix when implementing, reviewing, or updating the hooks.

Scenario	Expected behavior
Valid commit subject	Commit-message validation passes
Invalid commit subject	Commit is blocked
Configured lint check fails	Applicable hook fails
Optional lint script is missing	Explicit warning, if skipping is supported
Strict mode has no test script	Push is blocked
Required test fails	Push is blocked
Optional formatting script is missing	Explicit warning, if skipping is supported
JSON mode enabled without its validator	Fail clearly; do not claim JSON validation passed
Required project file is missing	Fail with a useful diagnostic
Dependencies are missing	Fail clearly when the check requires them
CI validation fails	Required remote status check prevents merging
Hook is bypassed locally	CI and repository rules still enforce required checks

The actual expected behavior must be adjusted if the committed scripts intentionally implement a different policy.

11. GitHub Actions and branch protection

Local hooks are not a security boundary. They can be bypassed, omitted, or disabled in some environments.

For reliable repository-wide enforcement:

* Run required lint, formatting, tests, and build checks in GitHub Actions.
* Use the supported Node.js version from the project configuration.
* Install locked dependencies with npm ci where appropriate.
* Require successful CI checks before merging protected branches.
* Require pull requests and reviews according to project policy.
* Validate the revision under review, not an unrelated local working tree.
* Avoid making a CI workflow depend on the presence of a developer’s local Husky installation.
* Use appropriate workflow permissions and pin third-party actions according to repository policy.
* Keep secrets out of logs and untrusted pull-request execution contexts.
* Enforce authorization, data validation, and other security-critical controls in the application or server, not only in local hooks.

Local checks versus CI

Control	Local hooks	CI / repository rules
Fast feedback before committing	Primary purpose	Secondary
Prevent invalid local commit subjects	Yes, when enabled	Can validate commits independently
Prevent invalid pushes from a developer’s workstation	Yes, when enabled	Not dependent on local hooks
Enforce required checks for all contributors	No	Yes, when configured as required
Enforce application authorization	No	Application/server responsibility
Guarantee production readiness	No	CI contributes evidence; deployment controls also matter

12. Troubleshooting

A hook does not run

Check the repository root, hook path, and installed Husky version:

git rev-parse —show-toplevel
git config —get core.hooksPath
npm ls husky —depth=0

Then inspect the hook files:

ls -la .husky/

Check for:

* Missing Husky initialization.
* Incorrect hook filenames or locations.
* Shell syntax errors.
* Invalid quotation marks or copied typographic punctuation.
* CRLF or unexpected line-ending problems.
* Missing executable permissions where required.
* A custom Git hooks path that points somewhere else.
* Environment settings or commands that bypass hooks.

A commit is rejected

Read the diagnostic and correct the underlying issue.

For a commit-message failure, inspect:

* Type spelling and capitalization.
* Scope parentheses and allowed characters.
* Colon and required space.
* Description content.
* Subject length.
* The exact pattern enforced by the committed validator.

A push is rejected

Run the applicable checks manually:

npm run lint
npm test
npm run format:check
npm run build

Only run scripts that are configured. If strict mode requires a missing test script, implement a real test command and verify it locally and in CI.

If the failure is a Git or remote rejection rather than a quality check, inspect the Git output and remote repository policy separately.

A check is skipped

Inspect the available scripts:

npm run

A missing optional script may explain a warning. If the check is required for MedOrbits, add a real implementation, update the hook, and enforce it in CI.

Dependencies are missing

npm ci

Investigate installation errors, supported Node.js versions, registry access, and lockfile consistency before changing dependencies.

CI and local results differ

Compare:

* Node.js and npm versions.
* Dependency lockfile and installation procedure.
* Environment variables.
* Operating system and shell.
* Script arguments and working directory.
* Generated files and environment-specific configuration.
* The exact Git revision being tested.

Use CI as the authoritative result for required remote checks.

13. Security and reliability policy

The following practices apply to all MedOrbits hooks:

1. Never hard-code credentials, tokens, or API keys.
2. Do not print sensitive environment variables.
3. Do not treat a missing required check as a pass.
4. Do not suppress non-zero exit statuses from required validation.
5. Keep hooks deterministic and reasonably fast.
6. Quote shell variables when passing paths and arguments.
7. Validate external input and avoid executing commit-message content as shell code.
8. Keep hooks compatible with the declared shell and supported development environments.
9. Review changes to hook scripts, npm scripts, and CI workflows.
10. Enforce security-sensitive policies server-side.
11. Avoid automatic dependency upgrades as part of ordinary commit validation.
12. Keep error messages actionable without exposing secrets or sensitive repository data.

Bypass policy

Git provides mechanisms to bypass local hooks. Such bypasses must not be used to evade required checks.

Even if local hooks are bypassed, required CI checks and protected-branch rules should continue to apply. Any emergency exception should follow the repository’s documented review and authorization process.

14. Maintenance and change control

Whenever hook behavior changes:

1. Update the affected hook.
2. Update this README.
3. Verify package.json and package-lock.json.
4. Confirm that every required npm script exists.
5. Test both successful and failing validation cases.
6. Test standard and strict modes.
7. Test optional JSON validation if implemented.
8. Confirm commit-message examples match the actual regular expression.
9. Run the corresponding CI workflow.
10. Review the final diff and ensure the intended files are included in the commit.

Definition of done

A hook change is complete when:

* The intended behavior is implemented.
* Missing or invalid prerequisites fail clearly.
* The success and failure paths have been tested.
* Documentation matches the implementation.
* CI enforces any mandatory repository-wide policy.
* No secrets or unrelated configuration changes were introduced.

15. Final operational checklist

Before relying on MedOrbits hooks, verify the following:

* [ ]	Husky is installed at the expected version.
* [ ]	Git is configured to invoke the intended hooks.
* [ ]	.husky/pre-commit exists and has been tested.
* [ ]	.husky/commit-msg exists and has been tested.
* [ ]	.husky/pre-push exists and has been tested.
* [ ]	The commit-message validator is present at its configured location.
* [ ]	Supported npm scripts are documented accurately.
* [ ]	Strict pre-push mode rejects a missing required test script.
* [ ]	Optional JSON validation is implemented before being relied upon.
* [ ]	Standard and strict modes have been verified.
* [ ]	GitHub Actions runs the required checks independently.
* [ ]	Protected branches require the relevant CI status checks.
* [ ]	Documentation reflects the current implementation.

Maintenance principle: MedOrbits Git hooks should provide fast, predictable local feedback while CI and repository rules enforce the checks that must apply to every contributor.