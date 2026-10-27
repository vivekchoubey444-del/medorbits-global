🛠️ MedOrbits — Development Container

<p align=“center”>

Secure Development · Consistent Tooling · Responsible Contributions

</p>
<p align=“center”>
</p>

Welcome to the MedOrbits development container documentation.

The .devcontainer/ directory defines a consistent development environment for contributors and maintainers working on the MedOrbits education, admissions, career guidance, recruitment, and software platform.

The goal is to reduce environment inconsistencies while preserving repository integrity, minimizing unnecessary privileges, and keeping development separate from production.

⸻

📁 Directory Structure

.devcontainer/
├── devcontainer.json   # Development environment configuration
├── Dockerfile          # Development container image
└── README.md           # Setup, security and usage documentation

Configuration responsibilities

File	Responsibility
devcontainer.json	Workspace configuration, extensions, ports and lifecycle commands
Dockerfile	Development image, operating-system packages and default user
README.md	Setup instructions, security expectations and troubleshooting

These files should remain aligned. A change to one may require a corresponding change to another.

⸻

🚀 1. Prerequisites

Install the tools required for your chosen development environment:

* Docker Desktop or a compatible Docker Engine.
* Visual Studio Code.
* The Visual Studio Code Dev Containers extension.
* Git.
* Access to the MedOrbits repository.
* Sufficient disk space and memory for the development image and project dependencies.

The provided configuration targets Node.js 20 on Debian Bookworm. Check the repository’s package.json, engines field, lockfile and deployment configuration before changing the runtime version.

Compatibility note: Use a supported Node.js release appropriate to the project’s requirements. Update the development container and CI environment together when changing runtime versions.

⸻

🧰 2. Open the Development Container

1. Clone the repository or open an existing local checkout.
2. Inspect the repository’s Dockerfile, package scripts and dependency lockfile.
3. Open the repository in Visual Studio Code.
4. Open the Command Palette.
5. Select Dev Containers: Reopen in Container.
6. Allow the container image to build.
7. Review the terminal output for errors.

The development environment should provide the Node.js runtime, npm, Git, and the extensions configured in devcontainer.json.

Required configuration alignment

The current devcontainer.json and Dockerfile must agree on how the image is built.

If using .devcontainer/Dockerfile, configure the following in devcontainer.json:

{
  “build”: {
    “dockerfile”: “Dockerfile”
  }
}

Do not retain the earlier image property alongside this build configuration.

Also verify that the workspace mount, configured working directory and default node user are compatible with your local environment.

⸻

📦 3. Dependency Installation

The supplied configuration uses a lockfile-aware installation command.

When package-lock.json is present:

npm ci

This installs dependencies according to the committed npm lockfile and fails when the lockfile is inconsistent with package.json.

Before installing dependencies from an unfamiliar or potentially compromised repository:

1. Inspect package.json.
2. Review changes to package-lock.json.
3. Check lifecycle scripts such as preinstall, install and postinstall.
4. Review unfamiliar dependencies and their sources.
5. Use an appropriately isolated environment.

npm ci can execute package lifecycle scripts. A lockfile improves reproducibility but does not establish that every dependency is trustworthy.

Do not automatically run dependency installation on unreviewed changes.

⸻

🧪 4. Development Commands

Run only commands supported by the actual project scripts.

# Inspect runtime versions
node —version
npm —version
git —version
# Inspect repository state
git status —short —branch
# Install locked dependencies
npm ci
# Run tests if configured
npm test
# Run the development server if configured
npm run dev
# Run production build if configured
npm run build

The development server, test command and build command may differ depending on the contents of package.json.

Do not assume that every command is defined.

⸻

🔐 5. Security Standards

The development container is intended to support safer development, not to guarantee a secure application.

Container safeguards

The supplied Dockerfile:

* Uses a non-root node user by default.
* Avoids embedding application credentials in the image.
* Does not copy the application source into the image during build.
* Installs a limited set of operating-system utilities.
* Leaves application dependency installation to the development lifecycle.

Required contributor practices

* Never commit access tokens, passwords, private keys or production secrets.
* Do not copy production credentials into a development environment.
* Avoid running untrusted scripts with elevated privileges.
* Review changes to container configuration and dependency manifests.
* Keep Docker images and operating-system packages updated.
* Use least-privilege access for repository credentials.
* Do not expose development services publicly unless explicitly required.
* Do not disable required security checks to force a successful build.

Port exposure

The development container may forward port 3000.

Port forwarding is not equivalent to authentication or authorization. Ensure that the application applies appropriate access controls and that sensitive development services are not exposed unnecessarily.

The HOST setting of 0.0.0.0 allows the application to listen on container interfaces. Review port-forwarding and network settings before using the environment on an untrusted network.

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

Inspect the actual changes, including new and untracked files. These commands do not display every untracked file’s contents, so inspect untracked files separately.

Prohibited without explicit authorization

* Force-pushing.
* Deleting branches or tags.
* Resetting or discarding uncommitted work.
* Running destructive cleanup commands.
* Resolving large groups of conflicts without review.
* Changing branch protections or repository access.
* Modifying CI workflows to bypass required checks.
* Replacing unfamiliar files without investigating their origin.

Important: The VS Code Git settings are convenience controls, not a security boundary. Repository permissions and GitHub branch rules must enforce the actual restrictions.

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
* Required image features are available.
* The development environment has sufficient resources.

Useful command:

docker compose config

This validates Compose configuration when the repository contains a Compose file. It does not validate devcontainer.json.

npm installation fails

Check:

* package.json and package-lock.json are consistent.
* The Node.js version matches the project’s requirements.
* Registry access is available.
* The failure is not caused by a platform-specific dependency or lifecycle script.

Do not delete the lockfile as a first troubleshooting step.

Application cannot write files

The production Compose configuration uses a read-only root filesystem, whereas this development container is a separate environment.

Check filesystem permissions, mounted workspace paths and the application’s storage configuration. Do not solve permission problems by running everything as root without understanding the cause.

Git reports unexpected changes

Stop before committing or resetting.

git status —short —branch
git diff —stat
git diff —name-status

Investigate unfamiliar files and compare the current branch with a known-good commit. Preserve uncommitted and untracked work before performing recovery.

Application health check fails

Confirm that:

* The application starts successfully.
* The expected port is listening.
* The health endpoint exists.
* The endpoint returns a successful HTTP status.
* The configured runtime supports the health-check APIs.

The development container does not automatically configure or validate the production health check.

⸻

🧹 9. Maintenance

Review this directory whenever the application runtime, dependency tooling, repository architecture or security requirements change.

Recommended maintenance tasks:

* Review and update the base image.
* Verify compatibility with the supported Node.js version.
* Review development dependencies and lifecycle scripts.
* Keep VS Code extensions relevant and trustworthy.
* Review forwarded ports and container permissions.
* Validate configuration changes before merging.
* Keep documentation consistent with the actual repository.

For reproducibility-sensitive environments, consider pinning the base image by digest and updating it through a documented review process.

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

⸻

🌐 11. Related Documentation

Consult the following repository documents where available:

* README.md — Project overview and setup.
* CONTRIBUTING.md — Contribution authorization and review requirements.
* CODE_OF_CONDUCT.md — Professional conduct and reporting.
* SECURITY.md — Vulnerability reporting and security procedures.
* LICENSE — Applicable license terms.
* compose.yaml — Local or production-oriented service configuration.

Verify the presence and contents of each file before relying on its instructions.

⸻

<div align=“center”>

💙 MedOrbits

Build Responsibly · Protect Repository Integrity · Ship with Confidence

Development environment documentation · Version 1.0.0 · 2026

</div>