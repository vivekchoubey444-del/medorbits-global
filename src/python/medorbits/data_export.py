
def write_export(
    records: Iterable[Mapping[str, Any]],
    destination: TextIO,
    options: ExportOptions | None = None,
) -> int:
    """
    Write an export to an already-open text destination.

    Returns the number of exported data records, excluding CSV headers.
    The caller is responsible for authorization, destination permissions,
    retention, and cleanup if serialization fails partway through.
    """
    options = options or ExportOptions()

    if not callable(getattr(destination, "write", None)):
        raise TypeError("destination must be an open text stream.")

    if options.format == "json":
        text = export_json(records, options)
        destination.write(text)
        return len(json.loads(text))

    if options.format == "csv":
        iterator = iter_csv(records, options)
        count = 0

        for index, chunk in enumerate(iterator):
            destination.write(chunk)

            # iter_csv yields one chunk per CSV row, plus one optional header.
            if not (options.include_header and index == 0):
                count += 1

        return count

    if options.format == "jsonl":
        count = 0

        for chunk in iter_jsonl(records, options):
            destination.write(chunk)
            count += 1

        return count

    raise ExportFormatError("Unsupported export format.")
