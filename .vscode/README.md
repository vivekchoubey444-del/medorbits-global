
# MedOrbits — VS Code Workspace Configuration

**Directory:** `.vscode/`  
**File:** `README.md`  
**Release target:** `2.0.0`  
**Purpose:** Document safe, consistent Visual Studio Code settings and development workflows for the MedOrbits repository.

—

## 1. Purpose

The `.vscode/` directory contains optional workspace configuration for developers working on MedOrbits.

It may provide shared editor recommendations, debugging examples, task definitions, and formatting guidance.

Workspace configuration must remain compatible with the existing repository structure, Node.js runtime, frontend assets, API modules, and deployment workflow.

**Security rule:** Do not commit personal workspace settings, local filesystem paths, credentials, tokens, or environment-specific secrets.

## 2. Recommended Directory Structure

```text
.vscode/
├── README.md
├── extensions.json
├── settings.example.json
├── launch.example.json
└── tasks.example.json
```

Create optional files only when they are needed.

| File | Purpose |
|—|—|
| `README.md` | Documents workspace configuration and safety practices |
| `extensions.json` | Recommends useful editor extensions |
| `settings.example.json` | Provides sanitized editor settings |
| `launch.example.json` | Provides example debugging configurations |
| `tasks.example.json` | Documents optional development tasks |

The example files are templates. Rename or copy them into active VS Code configuration files only after reviewing their contents.

## 3. Supported Development Environment

The recommended environment includes:

- Node.js 20 or later, following the version declared by the project.
- npm and the repository’s committed package lockfile.
- JavaScript ES modules where configured by `package.json`.
- HTML, CSS, JavaScript, and JSON support.
- Git integration and reviewed repository workflows.
- Optional Python support for scripts and utilities that use Python.

Use the repository’s actual `package.json`, `.nvmrc`, and CI configuration as the source of truth for runtime versions and commands.

Do not assume that a recommended runtime version is the version currently installed on every developer’s machine.

## 4. Editor Settings

Recommended settings for a shared workspace:

- Use UTF-8 encoding.
- Use consistent line endings and indentation.
- Trim trailing whitespace on save.
- Insert a final newline.
- Associate JSON files with the JSON language service.
- Enable format-on-save only when the repository has an agreed formatter.
- Avoid overriding project-specific formatting rules.
- Keep terminal output and diagnostics readable.

Example settings may be maintained in `settings.example.json`. These settings are not active automatically.

Review all shared settings for compatibility with `.editorconfig`, ESLint, Prettier, and other project-level configuration before adopting them.

## 5. Recommended Extensions

Use extensions only when they provide practical value for the current codebase.

Potential categories include:

- JavaScript and Node.js development.
- ESLint and Prettier, if configured by the project.
- HTML and CSS assistance.
- JSON validation and schema support.
- Git history and diff inspection.
- Accessibility checking.
- Markdown editing and preview.
- GitHub Actions workflow editing.

Keep extension recommendations in `extensions.json`.

Avoid recommending extensions that duplicate existing tooling or require unnecessary access to private source code. Verify each extension’s publisher and identifier before recommending installation.

Extension recommendations do not install extensions automatically or enforce repository policy.

## 6. Debugging Configuration

Debugging examples may be stored in `launch.example.json`.

Before enabling a launch configuration, verify:

1. Its entry point exists.
2. Its working directory is correct.
3. Its environment variables are safe.
4. It does not contain production credentials.
5. It does not bypass authentication or authorization.
6. Its port does not conflict with another running service.
7. Its debugger configuration matches the installed Node.js version.
8. Its module format matches the project’s configuration.

Use local environment files for development secrets. Never embed secrets directly in launch configurations.

Do not expose the Node.js inspector on a public network. Bind it to localhost unless a properly secured remote-debugging setup is explicitly required.

## 7. Development Tasks

Optional task examples may be stored in `tasks.example.json`.

Tasks can support routine operations such as:

- Running the development server.
- Running unit tests.
- Checking JavaScript syntax.
- Validating JSON files.
- Running lint checks.
- Running a production build when supported.

Task commands must match the actual scripts declared in `package.json`. Do not invent commands or assume a test runner is installed.

Review tasks before execution, especially commands that delete files, rewrite generated output, modify Git state, or affect databases.

Tasks are executable commands. Do not treat a task as safe merely because it is stored in `.vscode/`.

## 8. Git Ignore Policy

The root `.gitignore` should prevent accidental commits of private workspace configuration.

A recommended policy is:

```gitignore
# Ignore workspace configuration by default.
.vscode/*

# Allow approved shared workspace files.
!.vscode/README.md
!.vscode/extensions.json
!.vscode/settings.example.json
!.vscode/launch.example.json
!.vscode/tasks.example.json
```

This policy allows the README and approved example files to be tracked while keeping other workspace files ignored.

**Important:** These rules do not automatically untrack files that are already committed. Review the current Git index before changing ignore rules. Git ignore rules also do not protect secrets from being committed through force-staging or other explicit Git operations.

## 9. Security Requirements

- Never store API keys, database passwords, tokens, or session secrets in workspace files.
- Do not embed production environment variables in debugging or task configurations.
- Avoid machine-specific absolute paths.
- Do not disable certificate verification to work around connection problems.
- Do not weaken repository security checks merely to suppress editor warnings.
- Review extension permissions and publisher identity before installation.
- Do not execute unfamiliar tasks or scripts without inspecting them.
- Keep local databases, uploaded documents, and private test fixtures outside tracked workspace configuration.
- Avoid exposing environment values in terminal output, debugger logs, or diagnostic reports.
- Keep personal settings and local overrides out of shared examples.
- Never commit real `.env` files or private credential stores.

Workspace configuration is part of the development environment and should receive the same review discipline as application code.

## 10. Validation Checklist

Before committing `.vscode/` changes:

- [ ] The README describes the actual workspace conventions.
- [ ] JSON example files parse successfully.
- [ ] No credentials or private local paths are present.
- [ ] Extension recommendations are relevant.
- [ ] Debug configurations reference valid entry points.
- [ ] Tasks use scripts that exist in `package.json`.
- [ ] Root `.gitignore` rules preserve approved example files.
- [ ] No existing source files or user data were deleted.
- [ ] Changes have been reviewed using `git diff`.
- [ ] Configuration is compatible with the project’s module system.
- [ ] Any referenced environment files are local and excluded from Git.
- [ ] Applicable validation checks have actually been executed.

Do not mark checks as passed until their results have been verified.

## 11. Safe Git Workflow

Inspect workspace changes before staging:

```bash
git status —short
git diff — .vscode/ .gitignore
```

Check whether files are ignored:

```bash
git check-ignore -v .vscode/settings.json
git check-ignore -v .vscode/settings.example.json
```

Check whether a file is already tracked:

```bash
git ls-files —error-unmatch .vscode/settings.json
```

The last command returns a nonzero exit status if the file is not tracked. This is expected for a new or ignored file.

After reviewing the changes, stage only the intended files:

```bash
git add .vscode/README.md
git add .vscode/extensions.json
```

Add example files individually when they exist and have been reviewed:

```bash
git add .vscode/settings.example.json
git add .vscode/launch.example.json
git add .vscode/tasks.example.json
```

Do not run these commands for files that do not exist. Do not use `git add -f` to bypass ignore rules without first understanding why the file is ignored.

Review the staged changes before committing:

```bash
git diff —cached —check
git diff —cached — .vscode/ .gitignore
git status —short
```

If the repository has unresolved merge conflicts or uncommitted recovery work, resolve and review those issues before staging workspace changes. Preserve unrelated modifications and newly created files.

## 12. Maintenance

Update this documentation when:

- The Node.js version changes.
- Workspace conventions change.
- New development tools are adopted.
- Debugging or task workflows change.
- The root `.gitignore` policy changes.
- New security requirements affect local development.
- Package scripts or test commands change.
- The repository’s module system or build process changes.

Remove obsolete configuration only after checking its dependencies and confirming that it is no longer needed.

Keep the documentation aligned with the actual repository rather than assuming every example file exists.

## 13. Official References

- [Visual Studio Code workspace settings](https://code.visualstudio.com/docs/configure/settings)
- [VS Code extension recommendations](https://code.visualstudio.com/docs/editor/extension-marketplace#_workspace-recommended-extensions)
- [VS Code debugging](https://code.visualstudio.com/docs/debugtest/debugging)
- [VS Code tasks](https://code.visualstudio.com/docs/debugtest/tasks)
- [VS Code workspace trust](https://code.visualstudio.com/docs/editing/workspaces/workspace-trust)
- [Git documentation: gitignore](https://git-scm.com/docs/gitignore)
- [Node.js documentation](https://nodejs.org/docs/latest/api/)

—

## Final Principle

The MedOrbits `.vscode/` directory should improve development consistency without introducing machine-specific configuration, exposing secrets, or changing application behavior unexpectedly.

The repository’s actual source code, `package.json`, lockfile, and CI configuration remain the authoritative references for development and validation.

**Verification notice:** This document describes recommended practices. It does not confirm that every listed file exists, that workspace settings are active, or that any command has been executed successfully.
