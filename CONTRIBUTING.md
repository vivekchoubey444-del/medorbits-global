🤝 Contributing to MedOrbits

<p align=“center”>
  <strong>🔐 Permission First · 🛡️ Security Always · ✅ Approval Required</strong>
</p>

Welcome to MedOrbits — an education, medical admissions, career guidance, and global opportunities platform.

We value responsible collaboration, code quality, transparency, and repository integrity. To protect the project, all contributions must follow the authorization and review requirements defined in this document.

🚨 STRICT POLICY: NO PERMISSION, NO CONTRIBUTION.

No person, bot, automation, integration, or external service may make an unauthorized contribution to MedOrbits. Written approval from the repository owner or an explicitly authorized maintainer is required before work is undertaken for submission to this repository.

⸻

📑 Table of Contents

* 1. Contribution Authorization
* 2. Who May Contribute
* 3. Permission Request Procedure
* 4. Prohibited Activities
* 5. Pull Request Requirements
* 6. Dependabot and Automated Contributions
* 7. Security and Repository Integrity
* 8. Review and Merge Policy
* 9. Reporting Unauthorized Changes
* 10. Enforcement
* 11. Contributor Checklist
* 12. Contact and Governance

⸻

🔐 1. Contribution Authorization

Prior authorization is mandatory.

Before making a contribution intended for MedOrbits, a contributor must obtain explicit written permission from the repository owner or a maintainer who has been expressly authorized to approve that category of work.

Authorization must identify, at minimum:

1. The person or automation authorized to contribute.
2. The repository and intended branch.
3. The permitted task, files, or scope of modification.
4. Any applicable deadline or restrictions.
5. Whether a pull request, dependency update, workflow change, or other submission is permitted.

Approval for one task does not constitute blanket permission for unrelated work.

What counts as permission?

Acceptable authorization must be explicit, attributable, and recorded in an appropriate project communication channel, issue, or pull request.

The following do not constitute permission:

* A publicly accessible repository.
* The ability to clone, fork, push, or open a pull request.
* A previous contribution or approval.
* An automated bot opening a pull request.
* A green CI status or successful security scan.
* An assumption that a change would be beneficial.
* Silence, inactivity, or the absence of a rejection.

No response means no authorization.

👥 2. Who May Contribute

Contributions are limited to the following categories, subject to the applicable approval requirements.

Contributor	Permission requirement
Repository owner	May manage the repository within applicable security and organizational controls.
Designated maintainer	Must have the appropriate delegated authority for the proposed change.
External contributor	Must obtain prior authorization before undertaking an authorized contribution.
Dependabot	May submit dependency-update pull requests only under the repository’s explicitly configured automation policy.
Other bots and integrations	Must be specifically authorized and limited to their approved scope.
Unknown or unauthorized accounts	Must not contribute to protected project branches or receive write access.

Permission to submit a pull request does not automatically grant permission to merge it.

📨 3. Permission Request Procedure

Before beginning an authorized contribution:

1. Open an issue or use an official project communication channel.
2. Explain the problem, proposed solution, affected files, and intended outcome.
3. Identify any security, dependency, database, API, or deployment implications.
4. Wait for explicit written approval.
5. Complete only the approved scope.
6. Submit the changes through the approved process.

Do not begin repository modifications on the assumption that approval will be granted later.

If the requested scope changes materially, obtain additional authorization before proceeding.

⛔ 4. Prohibited Activities

Without explicit authorization, the following activities are prohibited:

* Direct pushes to protected branches.
* Unapproved pull requests or repository modifications.
* Unauthorized merges, rebases, cherry-picks, or history rewrites.
* Force-pushing or deleting branches and tags.
* Deleting, replacing, renaming, or moving project files.
* Modifying repository permissions, collaborators, teams, or rulesets.
* Changing GitHub Actions workflows, deployment settings, or security policies.
* Introducing dependencies, scripts, binaries, or executable artifacts.
* Changing environment variables, credentials, secrets, or access tokens.
* Modifying database schemas, API contracts, or production configuration.
* Disabling tests, security scans, approval requirements, or branch protections.
* Using another person’s account, token, credentials, or identity.
* Circumventing authorization through a bot, integration, fork, or alternate branch.

A technically successful operation is not evidence of authorization.

🔍 5. Pull Request Requirements

Every authorized pull request must:

* Reference the relevant issue or written approval.
* Describe the changes and explain why they are necessary.
* Identify affected files, components, APIs, or workflows.
* Include appropriate tests or validation evidence.
* Pass all required automated checks.
* Address relevant security and dependency concerns.
* Avoid unrelated changes and unexplained file deletions.
* Preserve existing functionality unless a change is explicitly approved.
* Receive the required maintainer review and merge approval.

Restricted changes

Changes involving the following areas require explicit, specific approval:

* .github/workflows/ and repository automation.
* Authentication, authorization, permissions, and security middleware.
* Dependency manifests and lockfiles.
* Deployment pipelines and production configuration.
* API schemas, database migrations, and data imports.
* License files and repository governance documents.
* Branch protection and security configuration.

Approval to modify one restricted area does not grant permission to modify the others.

🤖 6. Dependabot and Automated Contributions

MedOrbits may permit Dependabot to submit dependency updates under a restricted, auditable automation policy.

Dependabot requirements

1. The pull request must originate from the expected Dependabot identity.
2. The change must be within the approved dependency-update scope.
3. Required dependency, compatibility, and security checks must pass.
4. Required review and merge controls must remain enabled.
5. Unexpected workflow changes, lockfile manipulation, or unrelated modifications must be investigated.
6. Failed, suspicious, or out-of-scope updates must not be merged automatically.

A Dependabot identity is not a substitute for authorization. Automated contributions must remain subject to repository permissions, required status checks, and the configured review policy.

Do not grant Dependabot unrestricted write access or credentials merely to simplify dependency updates.

🛡️ 7. Security and Repository Integrity

All contributors and maintainers must protect the confidentiality, integrity, and availability of MedOrbits.

Required practices

* Never commit passwords, API keys, private keys, access tokens, or other secrets.
* Use least-privilege permissions for users, bots, and integrations.
* Preserve commit history and investigate unexplained changes.
* Keep security checks and required branch protections enabled.
* Review dependency changes before approving them.
* Use reproducible builds and committed lockfiles where applicable.
* Protect production credentials and deployment environments.
* Maintain backups or other recovery mechanisms before risky operations.
* Never use destructive cleanup commands without reviewing their effects.

If suspicious activity is detected

1. Stop the affected workflow or deployment when safe to do so.
2. Preserve commit hashes, timestamps, logs, and changed-file lists.
3. Secure potentially compromised accounts and credentials.
4. Review repository access, tokens, authorized applications, and automation.
5. Restore files only after identifying a trustworthy recovery point.
6. Document the incident and the corrective action.

Do not accuse a contributor of malicious activity solely because a commit, username, or automated action is unfamiliar.

✅ 8. Review and Merge Policy

A pull request may be merged only when all applicable conditions are satisfied:

* [ ]	Explicit authorization is recorded.
* [ ]	The change remains within the approved scope.
* [ ]	Required status checks have passed.
* [ ]	Required review approvals have been obtained.
* [ ]	Security and dependency findings have been addressed.
* [ ]	No unresolved blocking review comments remain.
* [ ]	No unexplained destructive changes are present.
* [ ]	The merger has the necessary repository permissions.

Passing CI does not authorize a merge. Approval does not override a failed required security check.

Where feasible, use GitHub rulesets or branch protection to enforce these requirements rather than relying solely on written policy.

🚨 9. Reporting Unauthorized Changes

If you identify an unauthorized commit, unexpected deletion, suspicious workflow modification, or unfamiliar access:

* Record the commit SHA and affected branch.
* Preserve the changed-file list and relevant logs.
* Report the incident through an authorized project channel.
* Avoid merging, force-pushing, or deleting evidence.
* Follow SECURITY.md if a security vulnerability or credential exposure is involved.

Do not publish secret values or sensitive vulnerability details in public issues.

⚖️ 10. Enforcement

Violations of this policy may result in:

* Rejection or closure of unauthorized pull requests.
* Suspension or revocation of repository access.
* Disabling or restricting affected automation.
* Reverting unauthorized changes after preserving evidence and reviewing recovery options.
* Further incident response when unauthorized access or security compromise is suspected.

Any response must be proportionate, consistent with applicable law and platform rules, and performed by someone with the appropriate authority.

This policy does not replace GitHub’s access controls, applicable licenses, legal obligations, or organizational security requirements.

📋 11. Contributor Checklist

Before starting work:

* [ ]	I have obtained explicit written permission.
* [ ]	I understand the approved scope.
* [ ]	I have reviewed relevant project documentation.
* [ ]	I will not expose credentials or sensitive information.

Before submitting changes:

* [ ]	My changes are limited to the approved task.
* [ ]	I have run the applicable checks.
* [ ]	I have reviewed the changed-file list.
* [ ]	I have documented relevant risks and limitations.
* [ ]	I have included the authorization reference.

Before merging:

* [ ]	Required checks have passed.
* [ ]	Required review approvals are present.
* [ ]	No unauthorized or unexplained changes remain.
* [ ]	The merger is authorized to perform the operation.

📬 12. Contact and Governance

For contribution authorization, use the repository’s official issue tracker or another communication channel designated by the repository owner.

For security concerns, follow the instructions in SECURITY.md if available.

Repository: MedOrbits

Policy: Explicit authorization required before contribution.

Default decision: Deny until approved.

Final principle: Protect the codebase, preserve the history, verify every change, and merge only what is authorized.

⸻

<div align=“center”>

🔐 Permission First · 🛡️ Security Always · 🚀 Responsible Development

MedOrbits — Building trusted digital opportunities through accountable collaboration.

</div>