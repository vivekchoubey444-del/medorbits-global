MedOrbits repair patch

Validated in the extracted repository copy:
- Node entry-point syntax check passed.
- JSON validation: 92/92 valid, zero errors.
- Python tests: 332 passed, 1 skipped.
- Full strict gate remains blocked because Ruff is not installed in this execution environment.

Changes include syntax/configuration corrections already present in the supplied working tree, plus fixes to registry tests and the missing npm check:quality script. The archive excludes .env and Git metadata. Apply only after reviewing the diff against your current branch.
