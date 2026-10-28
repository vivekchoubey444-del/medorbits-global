MedOrbits Repository Reports

Purpose

This directory contains generated repository inventory, dependency analysis, reference validation, API route candidates, conflict-marker findings, and HTML connection proposals.

Report files

File	Purpose
summary.json	Scan metadata and aggregate statistics
file-inventory.json	Structured file inventory
file-inventory.csv	Spreadsheet-compatible file inventory
references.json	Individual detected references
dependency-edges.json	Structured dependency graph
dependency-edges.csv	Expanded dependency graph for spreadsheet analysis
broken-references.json	Potentially broken references
broken-references.csv	Spreadsheet-compatible broken-reference findings
unresolved-references.json	References requiring further investigation
api-routes.json	Heuristically discovered API routes and requests
conflict-markers.json	Potential Git conflict markers
parse-warnings.json	Read, parsing, and traversal warnings
page-connection-suggestions.json	Advisory HTML navigation proposals

Generate reports

From the repository root:

python -m py_compile tools/repository_connector.py
python tools/repository_connector.py —dry-run
python tools/repository_connector.py —show-conflicts

Dependency graph fields

* edge_id: stable identifier for a dependency edge.
* source_type, source_path, source_name: referencing file.
* relationship: nature of the dependency.
* target_type, target_path, target_name: referenced resource.
* dependency_scope: local, external, runtime, or unknown.
* optional: true, false, or unknown.
* source_line: reference line in the source file.
* discovery_method: how the reference was detected.
* verification_status: resolution and verification state.
* risk_level: review priority, not a security guarantee.
* notes: additional context.

Data integrity

Template files are not evidence of a completed scan. Generate the reports from the actual repository before using their statistics for release decisions.

Safety

The connector must not automatically edit application source files, delete files, resolve conflicts, or execute discovered source code. Review all findings before taking corrective action.