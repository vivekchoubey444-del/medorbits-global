MedOrbits — Husky Git Hooks

Project: MedOrbits
Release: 2.0.0
Directory: .husky/

1. Purpose

MedOrbits uses Husky Git hooks to run selected validation checks during Git operations.

The hooks help maintain consistent commit messages, detect common syntax errors, run configured tests, and reduce the risk of pushing broken code.

Hooks are local development safeguards. They do not replace GitHub Actions, code review, dependency auditing, or production security testing.

2. Directory Structure

.husky/
├── README.md
├── commit-msg
├── pre-commit
└── pre-push

Hook	Purpose
commit-msg	Validates the commit subject against the configured Conventional Commits format.
pre-commit	Checks staged JSON and JavaScript files and runs configured quality scripts.
pre-push	Runs repository checks and configured tests before pushing.
README.md	Documents hook setup, behavior, and troubleshooting.

The listed hook files must exist in the repository for the corresponding behavior to be available.

3. Requirements

Before enabling these hooks, verify that the development environment has:

* Git.
* Node.js compatible with the project’s engines requirement.
* npm, if the project uses npm scripts.
* Husky installed at a version compatible with the repository configuration.
* The project’s dependencies installed when a hook requires them.
* Bash where repository scripts such as VERIFY.sh, TEST.sh, or SCHEMA-CHECK.sh are invoked.

Some hooks use POSIX shell syntax; others call Bash scripts. Ensure the required shell is available on each supported development platform.

4. Husky Setup

For Husky v9, the root package.json commonly includes the following lifecycle script:

{
  “scripts”: {
    “prepare”: “husky”
  }
}

Merge this entry into the existing scripts object. Do not replace existing scripts or create duplicate JSON keys.

Install project dependencies using the approved development setup, then confirm that Husky initializes correctly.

Verify the installed Husky version before applying version-specific setup instructions. Older Husky releases use different configuration conventions.

5. Commit Message Convention

The commit-msg hook validates the first non-comment, non-empty line of the commit message.

Expected format:

type(scope): short description

Common types include:

* feat — new functionality.
* fix — bug fix.
* docs — documentation changes.
* style — formatting-only changes.
* refactor — code restructuring.
* perf — performance improvement.
* test — tests.
* build — build system or dependencies.
* ci — continuous integration.
* chore — maintenance.
* revert — reverting a previous change.

Examples:

feat(admissions): add course search
fix(api): handle missing application
docs: update support guide
test: add schema validation tests
chore(deps): update dependencies

The exact rules are determined by the committed commit-msg hook. Update this documentation if those rules change.

6. Pre-Commit Checks

The pre-commit hook may perform the following checks:

1. Parse staged JSON files.
2. Check staged JavaScript syntax.
3. Run the configured lint script when available.
4. Run the configured check script when available.

The hook should not install dependencies, stage additional files, create commits, or push changes.

Review the actual hook before relying on it as a mandatory quality gate. In particular, confirm how it handles missing dependencies and validation failures.

Recommended additional checks

Where appropriate, consider integrating:

* Unit tests.
* JSON Schema validation.
* Formatting checks.
* Secret scanning.
* TypeScript validation.
* Targeted tests for changed application components.

Avoid making every commit unnecessarily slow. Expensive checks can run in CI or before release.

7. Pre-Push Checks

The pre-push hook may check:

* The repository has a valid HEAD.
* The Git index contains no unresolved merge conflicts.
* Tracked JSON files have valid syntax.
* Tracked JavaScript files pass syntax checks.
* The configured npm test script passes.
* Available project verification scripts pass.

A pre-push hook can run against a large portion of the repository and may take longer than the pre-commit hook.

Review its actual behavior before relying on it. Missing dependencies or runtime tools should be handled deliberately rather than silently allowing an unverified release.

8. Repository Safety

Husky hooks should preserve developer work and avoid destructive automation.

They should not automatically:

* Run git reset —hard.
* Run git clean.
* Delete project files.
* Rewrite repository history.
* Resolve merge conflicts without review.
* Install or upgrade dependencies unexpectedly.
* Commit or push additional changes.
* Deploy to production without an authorized release workflow.

Before resolving conflicts, inspect git status, preserve modified and untracked files, and create a backup outside the repository.

9. Troubleshooting

Hooks do not run

Check that:

* Husky is installed and configured for the current version.
* The Git hooks path is configured correctly.
* The hook files are present in .husky/.
* The files are executable where Unix permissions are supported.
* The repository’s setup command has been run successfully.

Inspect the configured hooks path with:

git config —get core.hooksPath

A hook fails

1. Read the complete error output.
2. Identify the failing command.
3. Run that command manually.
4. Fix the underlying issue.
5. Rerun the relevant check.
6. Review the staged diff before committing or pushing again.

Do not bypass a failing hook merely to complete a release.

Missing dependencies

Install dependencies only through the project’s approved workflow. Do not let a hook automatically upgrade packages or rewrite the lockfile.

Line endings or executable permissions

Ensure shell scripts use compatible line endings and that executable permissions are preserved in Git where applicable.

10. Testing Hooks Safely

Before adopting changes to hooks across the team:

1. Test on a temporary branch.
2. Use a deliberately invalid commit message to confirm rejection.
3. Introduce an invalid JSON file in a controlled test to confirm detection.
4. Confirm that a valid commit passes.
5. Confirm that failed checks do not alter source files.
6. Verify the behavior in each supported development environment.

Do not use live production credentials or real user data during testing.

11. Local Hooks and CI

Local hooks can be bypassed or may not run in every environment. GitHub Actions and other CI checks should independently validate important release requirements.

The release pipeline should verify, as applicable:

* Tests and syntax checks.
* Dependency and lockfile consistency.
* Security scanning.
* Required environment configuration.
* Build success.
* Release tag and package version consistency.

A successful local hook does not certify that a release is secure or production-ready.

12. Maintainer Checklist

Before publishing the MedOrbits 2.0.0 release:

* [ ]	Confirm the installed Husky version.
* [ ]	Verify the root prepare script.
* [ ]	Confirm all documented hook files exist.
* [ ]	Test rejection of invalid commit messages.
* [ ]	Test failure handling for invalid JSON and JavaScript.
* [ ]	Verify configured npm scripts exist and behave as expected.
* [ ]	Confirm hooks do not modify or delete user work unexpectedly.
* [ ]	Verify required checks also run in CI.
* [ ]	Update this README when hook behavior changes.

13. Scope and Limitations

Husky hooks are local safeguards, not a complete security boundary. They cannot guarantee that every contributor runs the hooks or that every defect is detected.

Security incidents must follow the private reporting procedure in SECURITY.md. Ordinary development issues should use the documented support or issue-reporting process.

Status: Documentation prepared. Verify the actual hook implementations and Husky configuration before treating these checks as enforced release requirements.

⸻

MedOrbits — Education · Admissions · Careers · Recruitment

Study · Work · Grow