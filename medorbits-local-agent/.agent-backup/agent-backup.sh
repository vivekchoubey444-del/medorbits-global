#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$’\n\t’
umask 077

MedOrbits Local Agent -- Safe Backup Utility

Usage:

bash .agent-backup/agent-backup.sh

bash .agent-backup/agent-backup.sh /path/to/repository

bash .agent-backup/agent-backup.sh /path/to/repository /path/to/backup-storage

SCRIPT_DIR="$(cd – "$(dirname – "${BASH_SOURCE[0]}")" && pwd -P)"
DEFAULT_ROOT="$(cd – "$SCRIPT_DIR/../.." && pwd -P)"

SOURCE_ROOT="${1:-$DEFAULT_ROOT}"
SOURCE_ROOT="$(cd – "$SOURCE_ROOT" && pwd -P)"

BACKUP_PARENT="${2:-$SOURCE_ROOT/.agent-backups}"
mkdir -p – "$BACKUP_PARENT"
BACKUP_PARENT="$(cd – "$BACKUP_PARENT" && pwd -P)"

TIMESTAMP="$(date -u ‘+%Y%m%dT%H%M%SZ’)"
BACKUP_DIR="$BACKUP_PARENT/backup-$TIMESTAMP-$$"

log() {
printf ‘[agent-backup] %s\n’ "$*"
}

fail() {
printf ‘[agent-backup] ERROR: %s\n’ "$*" >&2
exit 1
}

command -v tar >/dev/null 2>&1 || fail "tar is required."
command -v find >/dev/null 2>&1 || fail "find is required."
command -v sha256sum >/dev/null 2>&1 ||
command -v shasum >/dev/null 2>&1 ||
fail "sha256sum or shasum is required."

[[ -d "$SOURCE_ROOT" ]] || fail "Source directory does not exist."
[[ "$SOURCE_ROOT" != "/" ]] || fail "Refusing to back up the filesystem root."

case "$BACKUP_PARENT/" in
"$SOURCE_ROOT/"*)
;;
*)
log "Backup storage is outside the source repository."
;;
esac

[[ ! -e "$BACKUP_DIR" ]] || fail "Backup destination already exists."

Refuse a destination inside a nested Git metadata directory.

case "$BACKUP_PARENT/" in
"$SOURCE_ROOT/.git/"*|"$SOURCE_ROOT/.git")
fail "Backup storage must not be inside .git."
;;
esac

mkdir -m 700 – "$BACKUP_DIR"
TEMP_LIST="$BACKUP_DIR/.file-list.tmp"
MANIFEST="$BACKUP_DIR/MANIFEST.txt"
ARCHIVE="$BACKUP_DIR/source-files.tar"

cleanup() {
rm -f – "$TEMP_LIST"
}
trap cleanup EXIT

log "Source: $SOURCE_ROOT"
log "Destination: $BACKUP_DIR"
log "Collecting eligible files…"

Archive regular files only. Do not follow symbolic links.

Exclude secrets, dependency trees, Git metadata, generated output,

the backup destination, and this script’s backup storage.

find "$SOURCE_ROOT" 
( -type d ( 
-name .git -o 
-name node_modules -o 
-name .next -o 
-name dist -o 
-name build -o 
-name coverage -o 
-name .agent-backups -o 
-name .agent-backup 
) -prune ) -o 
( -type f 
! -name ‘.env’ 
! -name ‘.env.’ 
! -name ’.pem’ 
! -name ‘.key’ 
! -name ’.p12’ 
! -name ‘*.pfx’ 
! -name ‘id_rsa’ 
! -name ‘id_ed25519’ 
! -name ‘credentials.json’ 
! -name ‘secrets.json’ 
! -name ‘secret’ 
! -name ‘credential’ 
-print0 ) > "$TEMP_LIST"

Convert absolute paths into source-root-relative paths.

RELATIVE_LIST="$BACKUP_DIR/.relative-list.tmp"
: > "$RELATIVE_LIST"

while IFS= read -r -d ‘’ file; do
relative="${file#"$SOURCE_ROOT"/}"

Reject paths that cannot safely be represented in the manifest.

[[ "$relative" != "$file" ]] || continue
[[ "$relative" != /* ]] || continue

printf ‘%s\0’ "$relative" >> "$RELATIVE_LIST"
done < "$TEMP_LIST"

FILE_COUNT=0
while IFS= read -r -d ‘’ _; do
FILE_COUNT=$((FILE_COUNT + 1))
done < "$RELATIVE_LIST"

(( FILE_COUNT > 0 )) || {
rm -f – "$RELATIVE_LIST"
fail "No eligible files found. No archive was created."
}

{
printf ‘MedOrbits Local Agent Backup\n’
printf ‘Created UTC: %s\n’ "$TIMESTAMP"
printf ‘Source root: %s\n’ "$SOURCE_ROOT"
printf ‘Files included: %s\n’ "$FILE_COUNT"
printf ‘Archive: source-files.tar\n’
printf ‘\nSecurity exclusions:\n’
printf ‘%s\n’ 
‘.git metadata’ 
‘node_modules and generated build directories’ 
‘.env and .env.* files’ 
‘common private-key and credential filenames’ 
‘.agent-backups and .agent-backup directories’
printf ‘\nFile list:\n’
while IFS= read -r -d ‘’ relative; do
printf ‘%s\n’ "$relative"
done < "$RELATIVE_LIST"
} > "$MANIFEST"

Run tar from the source root, using relative paths.

–no-recursion prevents tar from independently walking listed directories.

Only regular files are listed by find.

(
cd – "$SOURCE_ROOT"
tar –null –files-from="$RELATIVE_LIST" 
–no-recursion 
-cf "$ARCHIVE"
) || fail "Archive creation failed. Inspect the destination before retrying."

rm -f – "$RELATIVE_LIST"

Generate an archive checksum.

if command -v sha256sum >/dev/null 2>&1; then
(
cd – "$BACKUP_DIR"
sha256sum source-files.tar > SHA256SUMS.txt
)
else
(
cd – "$BACKUP_DIR"
shasum -a 256 source-files.tar > SHA256SUMS.txt
)
fi

Verify that the archive can be listed successfully.

tar -tf "$ARCHIVE" >/dev/null ||
fail "Archive verification failed. Do not use this backup for recovery."

chmod 600 "$ARCHIVE" "$MANIFEST" "$BACKUP_DIR/SHA256SUMS.txt"

log "Backup archive created and readable."
log "Files included: $FILE_COUNT"
log "Manifest: $MANIFEST"
log "Checksum: $BACKUP_DIR/SHA256SUMS.txt"
log "Archive: $ARCHIVE"
log "NOTE: This is a file backup, not a Git history or full repository backup."
log "NOTE: Review exclusions and verify the checksum before any restoration."