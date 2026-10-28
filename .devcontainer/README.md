🛠️ MedOrbits — Development Container

<p align=“center”>
  <strong>Secure Development · Consistent Tooling · Responsible Contributions</strong>
</p>

Welcome to the MedOrbits development container documentation.

The .devcontainer/ directory defines a consistent development environment for contributors and maintainers working on the MedOrbits education, admissions, career guidance, recruitment, and software platform.

The goal is to reduce environment inconsistencies while preserving repository integrity, minimizing unnecessary privileges, and keeping development separate from production.

⸻

📁 Directory Structure

.devcontainer/
├── devcontainer.json   # Workspace configuration and lifecycle commands
├── Dockerfile          # Development image and operating-system packages
└── README.md           # Setup, security, and usage documentation

File	Responsibility
devcontainer.json	Workspace configuration, extensions, ports, and lifecycle commands
Dockerfile	Development image, operating-system packages, and default user
README.md	Setup instructions, security expectations, and troubleshooting

Keep these files aligned. A change to one may require a corresponding change to another.

⸻

🚀 1. Prerequisites

Install the tools required for your chosen development environment:

* Docker Desktop or a compatible Docker Engine.
* Visual Studio Code.
* The Visual Studio Code Dev Containers extension.
* Git.
* Access to the MedOrbits repository.
* Sufficient disk space and memory for the development image and project dependencies.

The supplied container configuration targets Node.js 20 on Debian Bookworm and provides Python tooling. Verify the actual runtime versions against package.json, its engines field, the dependency lockfile, and CI configuration before changing the runtime.

Compatibility note: Node.js 20 reached its scheduled end of life in April 2026. For a new or maintained environment, migrate to a currently supported Node.js LTS release that is compatible with the project. Update the Dockerfile, Dev Container configuration, CI workflows, and documentation together. Do not assume changing the base image alone guarantees compatibility.

⸻

🧰 2. Open the Development Container

1. Clone the repository or open an existing local checkout.
2. Inspect the Dockerfile, package scripts, dependency manifests, and lockfiles.
3. Open the repository in Visual Studio Code.
4. Open the Command Palette.
5. Select Dev Containers: Reopen in Container.
6. Allow the image to build.
7. Review the terminal output for errors.

The development environment should provide Node.js, npm, Git, Python, and the extensions configured in devcontainer.json.

Required configuration alignment

Because the project uses .devcontainer/Dockerfile, configure devcontainer.json to build from that Dockerfile:

{
  “build”: {
    “dockerfile”: “Dockerfile”
  }
}

The path is relative to the .devcontainer/ directory.

When using this configuration, remove the top-level image property. Do not configure both image and build for the same container definition.

Verify that the workspace mount, working directory, and non-root node user are compatible with the local environment.

⸻

📦 3. Dependency Installation

The supplied lifecycle configuration uses a lockfile-aware installation strategy.

When package-lock.json is present:

npm ci

This installs dependencies according to the committed npm lockfile and fails when the lockfile is inconsistent with package.json.

If package.json exists without package-lock.json, review the repository’s intended package manager before installing dependencies. Do not silently generate or replace a lockfile as part of an unrelated setup task.

Before installing dependencies from an unfamiliar or potentially compromised repository:

1. Inspect package.json.
2. Review changes to dependency manifests and lockfiles.
3. Check lifecycle scripts such as preinstall, install, and postinstall.
4. Review unfamiliar dependencies and their sources.
5. Use an appropriately isolated environment.

Security note: npm ci can execute package lifecycle scripts. A lockfile improves reproducibility but does not prove that every dependency is trustworthy. Use —ignore-scripts only when appropriate for the project; some packages require installation scripts to function correctly.

Do not automatically install dependencies from unreviewed changes.

Python dependencies

Create a project-local virtual environment rather than installing application tooling globally:

python3 -m venv .venv

Activate it:

# Linux / macOS
source .venv/bin/activate
# Windows PowerShell
.venv\Scripts\Activate.ps1

Install Python dependencies only after reviewing the repository’s dependency files:

python -m pip install -r requirements.txt

If the repository uses a different dependency manager or a dedicated development requirements file, follow that project’s documented workflow.

⸻

🧪 4. Development Commands

Run only commands supported by the actual project configuration.

Inspect runtime versions

node —version
npm —version
python3 —version
git —version

Inspect repository state

git status —short —branch
git log -5 —oneline —decorate

Install locked Node.js dependencies

npm ci

Run tests, when configured

npm test

Start the development server, when configured

npm run dev

Build the application, when configured

npm run build

Run Python validation, when available

python -m pytest -q
python -m ruff check .

The development server, test command, build command, and Python tooling may differ depending on the repository contents. Check package.json, pyproject.toml, ruff.toml, and the relevant documentation before executing them.

Do not assume every command is defined.

⸻

🔐 5. Security Standards

The development container supports safer development practices; it does not guarantee that the application or its dependencies are secure.

Container safeguards

The supplied Dockerfile is intended to:

* Use the non-root node user for normal development.
* Avoid embedding application credentials in the image.
* Avoid copying application source into the image during build.
* Install a limited set of operating-system utilities.
* Leave application dependency installation to the Dev Container lifecycle.
* Avoid running application deployment commands or database migrations automatically.

These are configuration goals, not a substitute for verifying the effective container configuration and runtime permissions.

Required contributor practices

* Never commit access tokens, passwords, private keys, or production secrets.
* Do not copy production credentials into a development environment.
* Avoid running untrusted scripts with elevated privileges.
* Review changes to container configuration and dependency manifests.
* Keep base images and operating-system packages updated.
* Use least-privilege access for repository credentials.
* Do not expose development services publicly unless explicitly required.
* Do not disable required security checks to force a successful build.
* Treat untrusted repository files and lifecycle scripts as potentially executable code.

Port exposure

The development container may forward port 3000.

Port forwarding is not equivalent to authentication or authorization. Ensure that the application applies appropriate access controls and that sensitive development services are not exposed unnecessarily.

The HOST=0.0.0.0 setting allows the application to listen on container network interfaces. Review port-forwarding and network settings before using the environment on an untrusted network.

Do not assume that a forwarded port is accessible only to authorized users without verifying the host environment and forwarding behavior.

Secrets

Do not place API keys, database passwords, private tokens, or production credentials in:

* The Dockerfile.
* devcontainer.json.
* Committed .env files.
* Build arguments or image labels.
* Shell history or logs.

Use untracked local environment files or an approved secrets manager where appropriate. Ensure secret files are excluded from version control and never print secret values in diagnostic output.

⸻

🛡️ 6. Git Integrity and Repository Protection

MedOrbits requires responsible handling of source code and repository history.

Before making changes

git status —short —branch
git log -5 —oneline —decorate
git diff —check

Review the current branch and uncommitted changes before proceeding.

Before committing

git diff —stat
git diff —name-status
git diff —check
git status —short

Inspect the actual changes, including new and untracked files. git diff does not include untracked file contents, so inspect those separately.

Prohibited without explicit authorization

* Force-pushing.
* Deleting branches or tags.
* Resetting or discarding uncommitted work.
* Running destructive cleanup commands.
* Resolving large groups of conflicts without review.
* Changing branch protections or repository access.
* Modifying CI workflows to bypass required checks.
* Replacing unfamiliar files without investigating their origin.

Important: VS Code Git settings are convenience controls, not a security boundary. Repository permissions, protected branches, required reviews, and GitHub rulesets must enforce actual restrictions.

For recovery after suspicious changes, preserve a separate copy of the working tree, including untracked files, before attempting repairs.

⸻

🤝 7. Contribution Authorization

All contributions must comply with the repository’s CONTRIBUTING.md and applicable project policies.

Before contributing:

1. Obtain the required authorization.
2. Confirm the approved task and scope.
3. Review the repository’s current state.
4. Make only the authorized changes.
5. Run the relevant checks.
6. Inspect the complete changed-file list.
7. Submit a pull request through the approved process.

Automated contributions must also comply with the repository’s dependency-update and CI policies.

A successful build or security scan does not itself authorize a contribution or merge.

⸻

🩺 8. Troubleshooting

Container fails to build

Check:

* Docker is running.
* The base image is accessible.
* The Dockerfile path is correct.
* Required Dev Container features are available.
* The environment has sufficient resources.
* The configured user and workspace permissions are valid.

If the repository contains a Compose file, validate its configuration with:

docker compose config

This validates Compose configuration only; it does not validate devcontainer.json.

npm installation fails

Check:

* package.json and package-lock.json are consistent.
* The Node.js version matches project requirements.
* Registry access is available.
* The error is not caused by a platform-specific dependency or lifecycle script.

Do not delete the lockfile as a first troubleshooting step.

Application cannot write files

Check filesystem permissions, mounted workspace paths, and application storage configuration.

The development container and production Compose configuration may have different filesystem permissions. A production service using a read-only root filesystem does not imply that the development container has the same restriction.

Do not solve permission problems by running everything as root without understanding the cause.

Git reports unexpected changes

Stop before committing or resetting.

git status —short —branch
git diff —stat
git diff —name-status

Investigate unfamiliar files and compare the current branch with a known-good commit. Preserve uncommitted and untracked work before attempting recovery.

Application health check fails

Confirm that:

* The application starts successfully.
* The expected port is listening.
* The health endpoint exists.
* The endpoint returns the expected HTTP status.
* The configured runtime supports the health-check APIs.

The development container does not automatically configure or validate the production health check.

⸻

🧹 9. Maintenance

Review this directory whenever the application runtime, dependency tooling, repository architecture, or security requirements change.

Recommended maintenance tasks:

* Review and update the base image.
* Verify compatibility with the supported Node.js and Python versions.
* Review development dependencies and lifecycle scripts.
* Keep VS Code extensions relevant and trustworthy.
* Review forwarded ports and container permissions.
* Validate configuration changes before merging.
* Keep documentation consistent with the actual repository.
* Review container build and dependency installation behavior.
* Consider pinning the base image by digest for stronger reproducibility.

Update pinned images through a documented review process rather than allowing unreviewed changes to alter the development environment.

⸻

📋 10. Pre-Commit Checklist

Before submitting changes to .devcontainer/:

* [ ]	The configuration uses the intended Dockerfile.
* [ ]	JSON syntax is valid.
* [ ]	The runtime version matches project requirements.
* [ ]	No secrets are embedded in the image or configuration.
* [ ]	The container runs with the intended non-root user.
* [ ]	Workspace paths and file permissions are correct.
* [ ]	Port exposure is appropriate.
* [ ]	Dependency installation behavior has been reviewed.
* [ ]	Git safeguards and repository rules remain intact.
* [ ]	The change has the required authorization.
* [ ]	Documentation accurately describes the implemented controls.
* [ ]	The container builds and opens successfully.
* [ ]	Required validation and tests pass.

⸻

🌐 11. Related Documentation

Consult the following repository documents where available:

* README.md — Project overview and setup.
* CONTRIBUTING.md — Contribution and review requirements.
* CODE_OF_CONDUCT.md — Professional conduct and reporting.
* SECURITY.md — Vulnerability reporting and security procedures.
* LICENSE — Applicable license terms.
* compose.yaml — Local or production-oriented service configuration, if present.

Verify the presence and contents of each file before relying on its instructions.

⸻

<p align=“center”>
  <strong>💙 MedOrbits</strong><br>
  Build Responsibly · Protect Repository Integrity · Ship with Confidence
</p>
<p align=“center”>
  Development environment documentation · Version 1.0.0 · 2026
</p>