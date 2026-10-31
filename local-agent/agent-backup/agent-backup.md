
# MedOrbits Local Agent — Backup Manager

**File:** `/local-agent/agent-backup/agent-backup.md`  
**Script:** `/local-agent/agent-backup/agent-backup.sh`  
**Version:** `1.0.0`  
**Runtime:** Bash 4+  
**Dependencies:** `tar`, `gzip`, `sha256sum`, `find`, `sort`, `date`, `mktemp`

## 1. Purpose

The backup manager creates timestamped archives of the MedOrbits local agent or the entire repository. It supports:

- Local-agent and full-repository backups.
- SHA-256 checksum generation and integrity verification.
- Backup listing and configurable retention.
- Safe restoration into a separate directory.
- Exclusion of common caches, build artifacts, environment files, and private-key files.
- Basic concurrency protection for backup and restore operations.

## 2. Directory Structure

```text
local-agent/
├── agent-backup/
│   ├── agent-backup.sh
│   ├── agent-backup.md
│   └── .agent-backup.lock
└── backups/
    ├── medorbits-local-agent-YYYYMMDD-HHMMSS.tar.gz
    ├── medorbits-local-agent-YYYYMMDD-HHMMSS.tar.gz.sha256
    ├── medorbits-repository-YYYYMMDD-HHMMSS.tar.gz
    └── medorbits-repository-YYYYMMDD-HHMMSS.tar.gz.sha256
```

The lock file is created during an operation and removed when the script exits normally or through a trapped exit. Stale lock files may require manual review.

## 3. Installation

From the repository root:

```bash
chmod +x local-agent/agent-backup/agent-backup.sh
```

Check the script version:

```bash
./local-agent/agent-backup/agent-backup.sh —version
```

Display available commands:

```bash
./local-agent/agent-backup/agent-backup.sh —help
```

## 4. Commands

### Create a local-agent backup

```bash
./local-agent/agent-backup/agent-backup.sh backup
```

Backs up the `/local-agent` directory, excluding configured files and generated artifacts.

### Create a full-repository backup

```bash
./local-agent/agent-backup/agent-backup.sh backup —full
```

Archives the repository root while excluding configured files and directories.

### List backups

```bash
./local-agent/agent-backup/agent-backup.sh list
```

Lists recognized backup archives and their sizes.

### Verify backups

```bash
./local-agent/agent-backup/agent-backup.sh verify
```

Checks available SHA-256 sidecar files and tests archive readability.

### Restore a backup

```bash
./local-agent/agent-backup/agent-backup.sh restore \
  /path/to/medorbits-local-agent-YYYYMMDD-HHMMSS.tar.gz
```

Extracts the archive into a newly created directory under the backup root. It does not intentionally overwrite the active repository.

**Review restored files before moving them into the production repository.**

## 5. Configuration

Configuration can be supplied through environment variables.

| Variable | Default | Purpose |
|—|—|—|
| `MEDORBITS_REPO_ROOT` | Auto-detected | Explicit repository root |
| `MEDORBITS_BACKUP_DIR` | `/local-agent/backups` | Backup storage directory |
| `MEDORBITS_BACKUP_RETENTION_DAYS` | `30` | Retention period in days |

Example:

```bash
MEDORBITS_REPO_ROOT=“$PWD” \
MEDORBITS_BACKUP_RETENTION_DAYS=14 \
./local-agent/agent-backup/agent-backup.sh backup —full
```

Set retention to `0` to disable automatic backup rotation.

## 6. Backup Integrity

Each successful backup generates a SHA-256 checksum file alongside the archive.

Example:

```text
medorbits-local-agent-YYYYMMDD-HHMMSS.tar.gz
medorbits-local-agent-YYYYMMDD-HHMMSS.tar.gz.sha256
```

Use the verification command after backup creation or before restoration.

For independent verification:

```bash
cd local-agent/backups
sha256sum —check medorbits-local-agent-YYYYMMDD-HHMMSS.tar.gz.sha256
```

A checksum verifies that an archive matches its checksum file. It does not prove authenticity if both files have been modified by an attacker.

## 7. Security Requirements

1. Store backups in a directory with restricted access.
2. Do not commit backup archives containing personal data or confidential information.
3. Keep production secrets in an approved secrets manager or encrypted storage.
4. Encrypt backups before transferring them to external storage.
5. Verify archives before restoration.
6. Inspect restored content before executing scripts or deploying files.
7. Keep at least one backup outside the primary machine or repository.
8. Regularly test recovery procedures.

The script excludes `.env` files and several common private-key extensions. These exclusions are not a complete data-loss-prevention system. Review the archive contents before transferring or sharing a backup.

## 8. Automation and Scheduling

A daily backup can be scheduled using cron.

Example — run every day at 02:00:

```cron
0 2 * * * cd /path/to/repository && ./local-agent/agent-backup/agent-backup.sh backup >> /var/log/medorbits-backup.log 2>&1
```

Replace `/path/to/repository` with the actual repository path.

Ensure the cron environment has the correct permissions, executable paths, and backup destination. Test the command manually before enabling scheduling.

## 9. Recovery Procedure

1. Stop processes that may modify the files being recovered.
2. Identify the required archive.
3. Verify its checksum and archive integrity.
4. Restore it to a separate directory.
5. Inspect files and compare them with the current repository.
6. Recover only the required files.
7. Run repository tests and security checks.
8. Resume services after confirming recovery.

## 10. Operational Limitations

- The backup is not a live database backup.
- Files modified during archive creation may not represent a consistent snapshot.
- Git metadata is excluded by the default configuration.
- Environment files and common private-key files are intentionally excluded.
- SHA-256 sidecar files are not independently signed.
- Retention is based on filesystem modification time.
- The script requires review and testing on the target operating system before production use.

For databases, use database-native backup tools and coordinate recovery with the application’s deployment process.

## 11. Recommended Validation

Run these commands after installation:

```bash
bash -n local-agent/agent-backup/agent-backup.sh
./local-agent/agent-backup/agent-backup.sh —help
./local-agent/agent-backup/agent-backup.sh backup
./local-agent/agent-backup/agent-backup.sh verify
./local-agent/agent-backup/agent-backup.sh list
```

Perform a test restoration in a non-production environment before relying on the backup system for disaster recovery.

## 12. Maintenance

Review this documentation whenever the backup script changes. Keep the documented commands, supported platforms, exclusions, and configuration defaults synchronized with the implementation.

**Status:** Documentation prepared for the MedOrbits local-agent backup manager. Validate the installed script against this documentation before production deployment.
