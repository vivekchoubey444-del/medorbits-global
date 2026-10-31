
def is_repository_root(root: Path) -> bool:
    git_entry = root / “.git”
    github_dir = root / “.github”

    return (
        (git_entry.exists() and not git_entry.is_symlink())
        or (git_entry.is_file() and not git_entry.is_symlink())
        or (github_dir.is_dir() and not github_dir.is_symlink())
    )


def ensure_safe_directory(root: Path, directory: Path) -> None:
    “””Create directories without traversing symbolic links.”””
    root = root.resolve(strict=True)
    directory = Path(os.path.abspath(directory))

    try:
        relative = directory.relative_to(root)
    except ValueError as exc:
        raise OSError(“Directory is outside repository root.”) from exc

    current = root

    for component in relative.parts:
        if component in (“”, “.”, “..”):
            raise OSError(“Invalid directory component.”)

        current = current / component

        try:
            current.mkdir()
        except FileExistsError:
            pass

        if current.is_symlink() or not current.is_dir():
            raise OSError(
                f”Unsafe directory component: {current}”
            )


def backup_file(source: Path, root: Path) -> Path:
    “””Create an exclusive backup without following source symlinks.”””
    if source.is_symlink() or not source.is_file():
        raise OSError(f”Unsafe backup source: {source}”)

    relative = source.relative_to(root)
    timestamp = datetime.now(timezone.utc).strftime(
        “%Y%m%dT%H%M%S%fZ”
    )

    backup_root = root / “.repair-backups” / timestamp
    destination = backup_root / relative

    ensure_safe_directory(root, destination.parent)

    flags = os.O_RDONLY
    if hasattr(os, “O_NOFOLLOW”):
        flags |= os.O_NOFOLLOW

    source_fd = os.open(source, flags)

    try:
        source_stat = os.fstat(source_fd)

        if not os.path.isfile(source):
            raise OSError(“Backup source is no longer a regular file.”)

        destination_flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL

        destination_fd = os.open(
            destination,
            destination_flags,
            0o600,
        )

        try:
            with os.fdopen(source_fd, “rb”, closefd=False) as src:
                with os.fdopen(destination_fd, “wb”) as dst:
                    while True:
                        chunk = src.read(1024 * 1024)
                        if not chunk:
                            break
                        dst.write(chunk)

                    dst.flush()
                    os.fsync(dst.fileno())

            os.chmod(destination, source_stat.st_mode & 0o777)

        except Exception:
            destination.unlink(missing_ok=True)
            raise

    finally:
        os.close(source_fd)

    return destination


def atomic_write(target: Path, content: str) -> None:
    “””Write to a temporary file and atomically replace the target.”””
    import tempfile

    if target.is_symlink():
        raise OSError(f”Refusing to replace symlink: {target}”)

    existing_mode = 0o600

    if target.exists():
        if not target.is_file():
            raise OSError(f”Target is not a regular file: {target}”)
        existing_mode = target.stat().st_mode & 0o777

    fd, temporary_name = tempfile.mkstemp(
        prefix=f”.{target.name}.”,
        suffix=“.tmp”,
        dir=target.parent,
    )

    temporary = Path(temporary_name)

    try:
        os.fchmod(fd, existing_mode)

        with os.fdopen(fd, “w”, encoding=“utf-8”, newline=“\n”) as file:
            file.write(content)
            file.flush()
            os.fsync(file.fileno())

        if target.is_symlink():
            raise OSError(f”Target became a symlink: {target}”)

        os.replace(temporary, target)

    finally:
        temporary.unlink(missing_ok=True)


def write_file(
    root: Path,
    relative: str,
    content: str,
    force: bool,
    backup: bool,
    dry_run: bool,
    created: list[str],
    updated: list[str],
    preserved: list[str],
    backups: list[str],
    errors: list[str],
) -> None:
    target = root / relative

    try:
        # Validate every parent directory before accessing the target.
        ensure_safe_directory(root, target.parent)

        if target.is_symlink():
            raise OSError(f”Refusing symlink target: {relative}”)

        if target.exists() and not target.is_file():
            raise OSError(
                f”Target is not a regular file: {relative}”
            )

        exists = target.is_file()

        if exists and not force:
            preserved.append(relative)

            if backup:
                if dry_run:
                    print(f”DRY-RUN: Would back up {relative}”)
                else:
                    saved = backup_file(target, root)
                    backups.append(saved.relative_to(root).as_posix())
                    print(
                        f”BACKUP: {saved.relative_to(root).as_posix()}”
                    )

            return

        if dry_run:
            action = “update” if exists else “create”
            print(f”DRY-RUN: Would {action} {relative}”)

            if exists:
                print(f”DRY-RUN: Would back up {relative}”)

            return

        if exists:
            # Forced updates always receive a backup.
            saved = backup_file(target, root)
            backups.append(saved.relative_to(root).as_posix())
            print(
                f”BACKUP: {saved.relative_to(root).as_posix()}”
            )

            atomic_write(target, content)
            updated.append(relative)

        else:
            # Exclusive creation: never overwrite a file created concurrently.
            try:
                with target.open(
                    “x”,
                    encoding=“utf-8”,
                    newline=“\n”,
                ) as file:
                    file.write(content)
                    file.flush()
                    os.fsync(file.fileno())

                created.append(relative)

            except FileExistsError:
                preserved.append(relative)
                print(
                    f”NOTICE: File appeared during setup; “
                    f”preserved {relative}”
                )

    except (OSError, ValueError, RuntimeError) as exc:
        errors.append(f”{relative}: {exc}”)
