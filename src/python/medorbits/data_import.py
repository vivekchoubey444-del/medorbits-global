
def iter_import_stream(
    source: TextIO,
    options: ImportOptions | None = None,
) -> Iterator[dict[str, Any]]:
    """
    Parse an already-open text stream with a bounded read.

    The stream is read into memory up to the configured UTF-8 byte limit.
    This prevents an unbounded read but does not provide fully incremental
    parsing of large files.
    """
    options = options or ImportOptions()

    if not callable(getattr(source, "read", None)):
        raise TypeError("source must be an open text stream.")

    chunks: list[str] = []
    total_bytes = 0
    chunk_chars = 8192

    while True:
        # Read bounded chunks rather than calling source.read() without a size.
        chunk = source.read(chunk_chars)

        if not isinstance(chunk, str):
            raise TypeError("source must be a text stream.")

        if not chunk:
            break

        total_bytes += len(chunk.encode("utf-8"))

        if total_bytes > options.max_file_bytes:
            raise ImportLimitError(
                "Input exceeds the configured "
                f"{options.max_file_bytes}-byte limit."
            )

        chunks.append(chunk)

    yield from iter_import_text("".join(chunks), options)
