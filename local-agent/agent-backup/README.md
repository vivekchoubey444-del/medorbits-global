
# MedOrbits Local Agent — Agent Backup

**Directory:** `/local-agent/agent-backup/`  
**Version:** `1.0.0`  
**Component:** Local Agent Backup and Recovery  
**Status:** Implementation documentation

## Overview

The `agent-backup` module provides backup and recovery utilities for the MedOrbits local agent. It is designed to preserve recoverable copies of agent files, verify archive integrity, and restore archived files without directly overwriting the active repository.

## Directory Contents

```text
local-agent/agent-backup/
├── README.md
├── agent-backup.md
└── agent-backup.sh
```

- `README.md` — Module overview, setup, usage, and operational guidance.
- `agent-backup.md` — Detailed backup and recovery documentation.
- `agent-backup.sh` — Bash utility for backup creation, listing, verification, retention, and restoration.

The script may create a `backups/` directory and a temporary lock file during operation.

## Requirements

- Bash 4 or compatible shell environment.
- `tar`
- `gzip`
- `sha256sum`
- `find`
- `sort`
- `date`
- `mktemp`

The script also uses common utilities such as `mkdir`, `mv`, `rm`, `du`, `awk`, and `dirname`.

## Installation

Run from the repository root:

```bash
chmod +x local-agent/agent-backup/agent-backup.sh
```

Check the script syntax:

```bash
bash -n local-agent/agent-backup/agent-backup.sh
```

Display the available commands:

```bash
./local-agent/agent-backup/agent-backup.sh —help
```

## Quick Start

### Create a local-agent backup

```bash
./local-agent/agent-backup/agent-backup.sh backup
```

### Back up the complete repository

```bash
./local-agent/agent-backup/agent-backup.sh backup —full
```

### List available archives

```bash
./local-agent/agent-backup/agent-backup.sh list
```

### Verify archive integrity

```bash
./local-agent/agent-backup/agent-backup.sh verify
```

### Restore an archive

```bash
./local-agent/agent-backup/agent-backup.sh restore \
  /path/to/medorbits-local-agent-YYYYMMDD-HHMMSS.tar.gz
```

Restoration extracts the archive into a separate directory under the configured backup location. Review the restored files before copying them into the active repository.

## Configuration

The following environment variables customize the backup process.

| Variable | Default | Description |
|—|—|—|
| `MEDORBITS_REPO_ROOT` | Automatically detected | Repository root directory |
| `MEDORBITS_BACKUP_DIR` | Agent backup directory | Destination for archives |
| `MEDORBITS_BACKUP_RETENTION_DAYS` | `30` | Retention period in days |

Example:

```bash
MEDORBITS_REPO_ROOT=“$PWD” \
MEDORBITS_BACKUP_RETENTION_DAYS=14 \
./local-agent/agent-backup/agent-backup.sh backup —full
```

Set `MEDORBITS_BACKUP_RETENTION_DAYS=0` to disable automatic rotation.

## Archive Naming

Archives use timestamps to avoid overwriting previous backups.

```text
backups/
├── medorbits-local-agent-YYYYMMDD-HHMMSS.tar.gz
├── medorbits-local-agent-YYYYMMDD-HHMMSS.tar.gz.sha256
├── medorbits-repository-YYYYMMDD-HHMMSS.tar.gz
└── medorbits-repository-YYYYMMDD-HHMMSS.tar.gz.sha256
```

The `.sha256` sidecar contains the checksum used by the verification command.

## Security

The backup utility excludes common generated directories and environment or private-key files according to its configured archive exclusions.

**Important safeguards:**

- Restrict access to backup archives.
- Do not commit backups containing confidential information.
- Store production credentials separately in an approved secrets manager.
- Encrypt backups before transferring them outside the local machine.
- Verify archives before restoration.
- Treat restored scripts and configuration files as untrusted until reviewed.
- Maintain a separate copy of critical backups outside the repository.

Exclusion patterns do not guarantee that every secret or sensitive file will be omitted. Inspect archive contents before sharing them.

## Validation

Run the following checks after setup:

```bash
bash -n local-agent/agent-backup/agent-backup.sh

./local-agent/agent-backup/agent-backup.sh —help

./local-agent/agent-backup/agent-backup.sh backup

./local-agent/agent-backup/agent-backup.sh verify

./local-agent/agent-backup/agent-backup.sh list
```

Test restoration in a non-production environment before relying on this utility for disaster recovery.

## Automation

A daily backup can be scheduled with cron after validating the script manually.

```cron
0 2 * * * cd /path/to/repository && ./local-agent/agent-backup/agent-backup.sh backup >> /var/log/medorbits-backup.log 2>&1
```

Replace `/path/to/repository` with the actual repository location. Configure appropriate permissions and ensure the scheduled environment can access the backup destination.

## Limitations

- Database contents require database-native backup procedures.
- Concurrent file modifications can produce an inconsistent snapshot.
- Git metadata is excluded by the script’s configured exclusions.
- Environment files and common private-key extensions are excluded.
- Checksums detect changes relative to their checksum files but do not independently establish authenticity.
- Production suitability depends on validation against the actual repository and operating environment.

## Recovery Workflow

1. Identify the required archive.
2. Verify the archive and checksum.
3. Restore to a separate directory.
4. Inspect the extracted contents.
5. Recover only the necessary files.
6. Run tests, schema validation, and security checks.
7. Resume services after verifying the recovered application.

## Maintenance

Keep this README synchronized with `agent-backup.sh` and `agent-backup.md` whenever commands, exclusions, configuration variables, or recovery behavior change.

**Module objective:** Provide a documented, verifiable, and recoverable backup process for the MedOrbits local agent without intentionally overwriting active repository files.
