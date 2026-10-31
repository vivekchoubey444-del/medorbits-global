
validate_log_destination() {
    local log_path="$1"
    local log_dir
    log_dir="$(dirname -- "$log_path")"

    # Verify the existing directory components before creating anything.
    python3 - "$REPO_ROOT" "$log_dir" <<'PY'
import os
import sys

root = os.path.realpath(sys.argv[1])
directory = os.path.abspath(sys.argv[2])

try:
    if os.path.commonpath((root, directory)) != root:
        raise SystemExit("log directory is outside the repository")
except ValueError:
    raise SystemExit("invalid log directory")

relative = os.path.relpath(directory, root)
current = root

if relative != ".":
    for component in relative.split(os.sep):
        if component in ("", ".", ".."):
            raise SystemExit("invalid directory component")

        current = os.path.join(current, component)

        if os.path.islink(current):
            raise SystemExit(
                f"symbolic link directory is not allowed: {current}"
            )
PY

    # Create missing directories only after initial validation.
    mkdir -p -- "$log_dir" ||
        die "Cannot create log directory: $log_dir"

    # Verify the resolved directory after creation.
    python3 - "$REPO_ROOT" "$log_dir" <<'PY'
import os
import sys

root = os.path.realpath(sys.argv[1])
directory = os.path.realpath(sys.argv[2])

try:
    if os.path.commonpath((root, directory)) != root:
        raise SystemExit("log directory resolves outside repository")
except ValueError:
    raise SystemExit("invalid log directory")
PY

    [[ ! -L "$log_path" ]] ||
        die "Refusing to write through a symbolic link: $log_path"

    [[ ! -e "$log_path" || -f "$log_path" ]] ||
        die "Log destination is not a regular file: $log_path"

    if [[ ! -e "$log_path" ]]; then
        (set -o noclobber; : > "$log_path") 2>/dev/null ||
            [[ -f "$log_path" && ! -L "$log_path" ]] ||
            die "Cannot create log file: $log_path"
    fi

    [[ -f "$log_path" && ! -L "$log_path" ]] ||
        die "Log destination changed or is not a regular file: $log_path"
}
