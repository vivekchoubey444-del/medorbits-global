MedOrbits Local Agent — Backup Utilities

1. Purpose

The .agent-backup/ directory contains documentation and utilities for creating local backups before making changes to the MedOrbits Local Agent or its target repository.

The backup workflow is designed to help preserve existing work, reduce accidental data loss, and provide a verifiable archive of eligible project files.

Important: Creating a backup script does not mean a backup has been created or verified. Run the script and inspect its output before relying on it.

2. Directory Structure

medorbits-local-agent/
└── .agent-backup/
    ├── README.md
    └── agent-backup.sh

Backups are intended to be stored separately in:

.agent-backups/
└── backup-<timestamp>-<process-id>/
    ├── source-files.tar
    ├── MANIFEST.txt
    └── SHA256SUMS.txt

The backup directory is created relative to the selected source repository unless a different destination is supplied.

The actual directory structure depends on the script version and its execution results.

3. Requirements

The backup script requires:

* A Bash-compatible shell.
* find for discovering eligible files.
* tar for creating an archive.
* sha256sum or shasum for generating a checksum.
* Read access to the source files.
* Write access to the backup destination.

The script uses GNU-style tar options. These options may not be available in every environment, including some mobile terminal applications.

Check compatibility before relying on the script in an unfamiliar shell.

4. Usage

Run the script from the medorbits-local-agent directory.

Make the script executable

chmod +x .agent-backup/agent-backup.sh

Back up the default source repository

bash .agent-backup/agent-backup.sh

The script resolves its default source relative to its own location.

Back up a specific repository

bash .agent-backup/agent-backup.sh “/path/to/MedOrbits-global”

Replace the example path with the actual repository path.

Specify a separate backup destination

bash .agent-backup/agent-backup.sh \
  “/path/to/MedOrbits-global” \
  “/path/to/backup-storage”

Use a destination outside the source repository when a separate storage location is available.

Never assume a backup is safe merely because the script exits successfully. Confirm the archive, manifest, and checksum.

5. Backup Contents

The script is intended to archive eligible regular files while preserving paths relative to the source repository.

It excludes several categories, including:

* .git/ metadata.
* node_modules/.
* Common generated directories such as dist/, build/, .next/, and coverage/.
* .agent-backups/ and .agent-backup/.
* .env and .env.* files.
* Common private-key extensions and selected credential filenames.

These exclusions are based on filename and directory patterns. They are not a complete secret-detection system.

A file containing a secret may still be included if it does not match an exclusion rule. Review the exclusion rules and the source repository before distributing or storing a backup.

6. Generated Files

source-files.tar

Contains the eligible regular files selected by the script.

The archive is not a complete clone of the repository. It excludes Git history, symbolic links, excluded directories, and excluded files.

MANIFEST.txt

Records information such as:

* Backup timestamp.
* Source repository path.
* Number of selected files.
* Archive name.
* Exclusion categories.
* Included relative paths.

The manifest is a record of the files selected by the script. It does not independently prove that every file is current or that every intended file was included.

SHA256SUMS.txt

Contains a SHA-256 checksum for the archive.

A matching checksum can help establish that the archive has not changed since the checksum was generated. It does not prove that the source selection was complete or that the original repository was healthy.

7. Verification

After the script finishes, inspect the backup directory.

Confirm that:

1. source-files.tar exists and is not unexpectedly empty.
2. MANIFEST.txt exists and lists the expected files.
3. SHA256SUMS.txt exists.
4. The archive can be listed successfully.
5. Important source files are present.
6. Sensitive information has not been unintentionally included.

To list archive contents:

tar -tf “/path/to/backup/source-files.tar”

To verify the checksum on a system with sha256sum:

cd “/path/to/backup”
sha256sum -c SHA256SUMS.txt

On systems using shasum, verify the checksum with the corresponding tool and format.

Do not restore files from an archive until you have reviewed its contents and verified its integrity.

8. Safety Rules

* Read and understand the script before running it.
* Confirm the source path and destination path.
* Keep the main MedOrbits application unchanged during backup.
* Do not automatically stage, commit, reset, clean, delete, or deploy files.
* Do not overwrite an existing backup without explicit authorization.
* Do not put real credentials or private keys in a backup intended for sharing.
* Do not treat a backup archive as a substitute for Git history.
* Keep backup files outside public web directories.
* Restrict access to backup files because source code can contain sensitive information.
* Do not run a restoration until the destination paths and archive contents have been checked.
* Preserve untracked files and ongoing work.

9. Limitations

The current script is a basic file-archive utility, not a complete disaster-recovery system.

Potential limitations include:

* GNU-specific tar options may fail on some platforms.
* Symbolic links are not included.
* Git history and repository metadata are excluded.
* Dependencies and generated files are excluded.
* Filename-based secret exclusions cannot detect every sensitive file.
* The archive may not represent a perfectly consistent snapshot if files change while the backup is running.
* The script does not provide a complete restoration workflow.
* A backup stored on the same device may be lost if that device fails.

For critical work, keep an additional verified backup in a separate, trusted location.

10. Recommended Workflow Before Repository Changes

1. Inspect Git status.
2. Identify staged, unstaged, untracked, and conflicted files.
3. Confirm the intended source repository.
4. Create the backup.
5. Verify the archive and checksum.
6. Review the file manifest.
7. Make changes in small, reviewable steps.
8. Run relevant tests.
9. Inspect the resulting diff.
10. Keep the backup until the changes have been verified and the user confirms it is no longer needed.

11. Status

This README documents the intended backup workflow.

It does not establish that a backup has been created, that the script has been executed successfully, or that restoration has been tested.

Update this document whenever the script’s behavior or backup format changes.

Core rule: Preserve existing work first. Verify the backup before relying on it. Never treat backup creation as permission to modify the repository.