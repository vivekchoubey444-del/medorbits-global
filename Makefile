
# =============================================================================
# MedOrbits Makefile
# File: /Makefile
# Purpose:
#   Unified development, validation, testing, security and release-readiness.
#
# Requirements:
#   Node.js >= 20.19.0
#   npm
#   Python >= 3.12
#   Git
#   GNU Make
#
# Safety:
#   - Default target is help.
#   - Validation targets do not intentionally modify source files.
#   - Install targets may modify local environments and dependencies.
#   - Format/fix targets modify source files.
#   - Cleanup is explicit and limited to known cache files.
#   - No automatic commit, push, tag or deployment.
# =============================================================================

.DEFAULT_GOAL := help
.DELETE_ON_ERROR:
.SUFFIXES:

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.SILENT:

NODE   ?= node
NPM    ?= npm
PYTHON ?= python3
PIP    ?= $(PYTHON) -m pip
GIT    ?= git

PACKAGE_FILE      := package.json
LOCK_FILE         := package-lock.json
SERVER_FILE       := server.js
JSON_CHECKER      := scripts/check-json.mjs
REQUIREMENTS_FILE := requirements.txt

.PHONY: help environment status \
        install install-python \
        check check-all check-strict validate validate-strict \
        check-syntax check-json check-json-strict check-json-api \
        check-json-all check-package-lock check-references \
        check-python-tools \
        test test-verbose test-collect test-fail-fast \
        lint lint-python lint-python-fix format-python format-check \
        typecheck-python quality \
        check-dependencies check-python-dependencies \
        audit-python audit-npm security \
        conflicts conflict-markers \
        release-preview release-validate \
        clean-cache

# -----------------------------------------------------------------------------
# Help
# -----------------------------------------------------------------------------

help: ## Show available targets
	@printf '\nMedOrbits development commands\n\n'
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_.-]+:.*## / {printf "  %-27s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@printf '\nCommon workflow:\n'
	@printf '  make environment\n'
	@printf '  make status\n'
	@printf '  make check\n'
	@printf '  make quality\n'
	@printf '  make security\n'
	@printf '  make release-validate\n\n'
	@printf 'Use "make -n TARGET" to preview commands without running them.\n'

# -----------------------------------------------------------------------------
# Environment and repository status
# -----------------------------------------------------------------------------

environment: ## Verify required tools and display versions
	@command -v "$(NODE)" >/dev/null || { echo "ERROR: Node.js not found"; exit 1; }
	@command -v "$(NPM)" >/dev/null || { echo "ERROR: npm not found"; exit 1; }
	@command -v "$(PYTHON)" >/dev/null || { echo "ERROR: Python not found"; exit 1; }
	@command -v "$(GIT)" >/dev/null || { echo "ERROR: Git not found"; exit 1; }
	@$(NODE) -e 'const v=process.versions.node.split(".").map(Number); if (v[0] < 20 || (v[0] === 20 && v[1] < 19)) { console.error("ERROR: Node.js >= 20.19.0 required"); process.exit(1); }'
	@$(PYTHON) -c 'import sys; sys.exit("ERROR: Python >= 3.12 required") if sys.version_info < (3, 12) else None'
	@echo "Node.js: $$($(NODE) --version)"
	@echo "npm: $$($(NPM) --version)"
	@echo "Python: $$($(PYTHON) --version)"
	@$(GIT) --version
	@$(GIT) rev-parse --show-toplevel

status: ## Show branch, working-tree status and HEAD
	@$(GIT) status --short --branch
	@$(GIT) log -1 --oneline

# -----------------------------------------------------------------------------
# Dependency installation
# -----------------------------------------------------------------------------

install: ## Install Node dependencies from the committed lockfile
	@test -f "$(PACKAGE_FILE)" || { echo "ERROR: $(PACKAGE_FILE) is missing"; exit 1; }
	@test -f "$(LOCK_FILE)" || { echo "ERROR: $(LOCK_FILE) is missing"; exit 1; }
	$(NPM) ci

install-python: ## Install Python requirements into the active environment
	@test -f "$(REQUIREMENTS_FILE)" || { echo "ERROR: $(REQUIREMENTS_FILE) is missing"; exit 1; }
	$(PIP) install -r "$(REQUIREMENTS_FILE)"

# -----------------------------------------------------------------------------
# JavaScript and JSON
# -----------------------------------------------------------------------------

check-syntax: ## Check JavaScript syntax
	@test -f "$(SERVER_FILE)" || { echo "ERROR: $(SERVER_FILE) is missing"; exit 1; }
	@test -f "$(JSON_CHECKER)" || { echo "ERROR: $(JSON_CHECKER) is missing"; exit 1; }
	$(NODE) --check "$(SERVER_FILE)"
	$(NODE) --check "$(JSON_CHECKER)"

check-json: ## Validate JSON using the project checker
	@test -f "$(JSON_CHECKER)" || { echo "ERROR: $(JSON_CHECKER) is missing"; exit 1; }
	$(NODE) "$(JSON_CHECKER)"

check-json-strict: ## Run strict JSON validation
	@test -f "$(JSON_CHECKER)" || { echo "ERROR: $(JSON_CHECKER) is missing"; exit 1; }
	$(NODE) "$(JSON_CHECKER)" --strict

check-json-api: ## Validate JSON under api/
	@test -d api || { echo "ERROR: api/ directory is missing"; exit 1; }
	@test -f "$(JSON_CHECKER)" || { echo "ERROR: $(JSON_CHECKER) is missing"; exit 1; }
	$(NODE) "$(JSON_CHECKER)" --root ./api

check-json-all: ## Include hidden paths if supported by the checker
	@test -f "$(JSON_CHECKER)" || { echo "ERROR: $(JSON_CHECKER) is missing"; exit 1; }
	$(NODE) "$(JSON_CHECKER)" --include-hidden

check-package-lock: ## Validate package JSON syntax and lockfile root metadata
	@test -f "$(PACKAGE_FILE)" || { echo "ERROR: $(PACKAGE_FILE) is missing"; exit 1; }
	@test -f "$(LOCK_FILE)" || { echo "ERROR: $(LOCK_FILE) is missing"; exit 1; }
	$(NODE) --input-type=commonjs -e '\
		const fs = require("node:fs"); \
		const p = JSON.parse(fs.readFileSync("package.json", "utf8")); \
		const l = JSON.parse(fs.readFileSync("package-lock.json", "utf8")); \
		if (!p || Array.isArray(p) || typeof p !== "object") throw Error("package.json root must be an object"); \
		if (!l || Array.isArray(l) || typeof l !== "object") throw Error("package-lock.json root must be an object"); \
		if (![2, 3].includes(l.lockfileVersion)) throw Error("Expected lockfileVersion 2 or 3"); \
		const root = l.packages && l.packages[""]; \
		if (!root) throw Error("Missing packages[\"\"] metadata"); \
		for (const k of ["name", "version"]) { \
			if (p[k] !== undefined && root[k] !== p[k]) throw Error("Lockfile mismatch for " + k); \
		} \
		console.log("Package JSON and lockfile root metadata are valid.");'

check-references: ## Run project JSON checker as a reference-validation pass
	@test -f "$(JSON_CHECKER)" || { echo "ERROR: $(JSON_CHECKER) is missing"; exit 1; }
	$(NODE) "$(JSON_CHECKER)"

# -----------------------------------------------------------------------------
# Python testing and quality
# -----------------------------------------------------------------------------

check-python-tools: ## Verify required Python quality tools are installed
	@$(PYTHON) -m pytest --version >/dev/null
	@$(PYTHON) -m ruff --version >/dev/null
	@$(PYTHON) -m mypy --version >/dev/null

test: ## Run Python tests
	$(PYTHON) -m pytest

test-verbose: ## Run Python tests verbosely
	$(PYTHON) -m pytest -v

test-collect: ## Collect tests without executing them
	$(PYTHON) -m pytest --collect-only

test-fail-fast: ## Stop at first test failure
	$(PYTHON) -m pytest -x

lint: lint-python ## Alias for Python lint

lint-python: ## Run Ruff lint checks
	$(PYTHON) -m ruff check .

lint-python-fix: ## Apply supported Ruff fixes; modifies source files
	$(PYTHON) -m ruff check --fix .

format-python: ## Format Python source files; modifies files
	$(PYTHON) -m ruff format .

format-check: ## Verify formatting without modifying files
	$(PYTHON) -m ruff format --check .

typecheck-python: ## Run mypy type checks
	$(PYTHON) -m mypy .

quality: check-python-tools lint-python format-check ## Run lint and formatting checks

# -----------------------------------------------------------------------------
# Unified validation
# -----------------------------------------------------------------------------

check: check-syntax check-json test ## Run syntax, JSON and Python tests

check-all: check quality ## Run standard checks plus Python quality checks

check-strict: check-syntax check-json-strict check-python-tools test quality typecheck-python ## Run strict validation

validate: check-all ## Alias for standard validation

validate-strict: check-strict ## Alias for strict validation

# -----------------------------------------------------------------------------
# Dependencies and security
# -----------------------------------------------------------------------------

check-dependencies: ## Inspect installed Node dependencies
	$(NPM) ls --depth=0

check-python-dependencies: ## Check installed Python dependency compatibility
	$(PIP) check

audit-python: ## Audit Python dependencies with pip-audit
	@$(PYTHON) -m pip_audit --version >/dev/null 2>&1 || { echo "ERROR: pip-audit is not installed in the active Python environment"; exit 1; }
	$(PYTHON) -m pip_audit

audit-npm: ## Audit npm dependencies
	$(NPM) audit

security: audit-npm audit-python ## Run npm and Python dependency audits

# -----------------------------------------------------------------------------
# Git integrity
# -----------------------------------------------------------------------------

conflicts: ## List unresolved Git index conflicts
	@$(GIT) diff --name-only --diff-filter=U

conflict-markers: ## Scan tracked files for likely merge conflict markers
	@set -eu; \
	$(GIT) rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "ERROR: Not inside a Git repository"; exit 1; }; \
	tmp="$$(mktemp)"; \
	trap 'rm -f "$$tmp"' EXIT; \
	rc=0; \
	$(GIT) ls-files -z | xargs -0 -r grep -nI -E '^(<<<<<<< |=======|>>>>>>> )' -- >"$$tmp" 2>/dev/null || rc=$$?; \
	if [[ "$$rc" -eq 0 ]]; then \
		cat "$$tmp"; \
		echo "WARNING: Review matches; legitimate documentation can contain these markers."; \
	elif [[ "$$rc" -eq 1 ]]; then \
		echo "No conflict-marker matches found in tracked files."; \
	else \
		cat "$$tmp"; \
		echo "ERROR: Conflict-marker scan failed with exit code $$rc"; \
		exit "$$rc"; \
	fi

# -----------------------------------------------------------------------------
# Release readiness
# -----------------------------------------------------------------------------

release-preview: ## Display release context without changing repository state
	@echo "Repository status:"
	@$(GIT) status --short --branch
	@echo
	@echo "Current commit:"
	@$(GIT) log -1 --format='%h %s'
	@echo
	@echo "Package version:"
	@$(NODE) -p 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")).version'
	@echo
	@echo "Recent tags:"
	@$(GIT) tag --sort=-version:refname | head -10 || true

release-validate: check-strict check-package-lock ## Validate before a release; does not create a tag
	@echo "Release validation checks passed."
	@echo "Review working-tree status, release notes and version before tagging."

# -----------------------------------------------------------------------------
# Explicit cleanup
# -----------------------------------------------------------------------------

clean-cache: ## Delete common Python cache directories and bytecode
	@echo "This removes .pytest_cache, .ruff_cache, __pycache__, and *.pyc/*.pyo files."
	@echo "Review this target before running it."
	@find . -type d \( -name .git -o -name node_modules -o -name .venv -o -name venv \) -prune -o \
		-type d \( -name .pytest_cache -o -name .ruff_cache -o -name __pycache__ \) \
		-prune -exec rm -rf -- {} +
	@find . -type d \( -name .git -o -name node_modules -o -name .venv -o -name venv \) -prune -o \
		-type f \( -name '*.pyc' -o -name '*.pyo' \) -delete
	@echo "Cache cleanup completed."

# =============================================================================
# END OF MAKEFILE
# =============================================================================
