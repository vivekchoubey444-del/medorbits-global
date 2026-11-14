
#!/usr/bin/env python3
“””
COLLEGEYATRA AUTOMATED REPOSITORY BUILDER
——————————————
Creates missing repository directories and files.

Safety:
- Never overwrites existing files.
- Never deletes existing files.
- Never writes real credentials.
- Creates a generation report.
- Supports custom repository paths.

Runtime: Python 3.10+
“””

from pathlib import Path
import argparse
import json
import os
import sys
from datetime import datetime

PROJECT_NAME = “COLLEGEYATRA”

# ============================================================
# REPOSITORY STRUCTURE
# ============================================================

DIRECTORIES = [
    “config”,
    “controllers”,
    “models”,
    “routes”,
    “services”,
    “middleware”,
    “validators”,
    “database”,
    “integrations”,
    “templates/email”,
    “templates/sms”,
    “templates/in-app”,
    “tests”,
    “tests/admin”,
    “tests/auth”,
    “tests/admissions”,
    “tests/colleges”,
    “tests/applications”,
    “docs”,
    “docs/api”,
    “docs/architecture”,
    “storage/backups”,
    “storage/documents”,
    “storage/exports”,
    “storage/quarantine”,
    “storage/temp”,
    “events”,
    “jobs”,
    “workers”,
    “assets/css”,
    “assets/js”,
    “assets/images”,
    “assets/fonts”,
    “pages”,
    “public”,
    “public/uploads”,
    “scripts”,
    “infrastructure/backup”,
    “infrastructure/deployment”,
    “.github/workflows”,
]

# ============================================================
# FILE MANIFEST
# ============================================================

FILES = {

    “package.json”: {
        “name”: “collegeyatra”,
        “version”: “1.0.0”,
        “private”: True,
        “description”: “CollegeYatra Education Consultancy Platform”,
        “main”: “server.js”,
        “engines”: {“node”: “>=22.0.0”},
        “scripts”: {
            “start”: “node server.js”,
            “dev”: “node —watch server.js”,
            “test”: “node —test”,
            “check”: “node —check server.js”
        },
        “dependencies”: {
            “cors”: “^2.8.5”,
            “dotenv”: “^16.4.7”,
            “express”: “^5.1.0”,
            “helmet”: “^8.1.0”,
            “pg”: “^8.16.3”
        },
        “devDependencies”: {}
    },

    “.env.example”: “””\
NODE_ENV=development
PORT=3000
DATABASE_URL=
SESSION_SECRET=
CORS_ORIGIN=http://localhost:3000
“””,

    “.gitignore”: “””\
node_modules/
.env
.env.*
!.env.example
coverage/
logs/
*.log
.DS_Store

# Private student information
storage/documents/*
!storage/documents/.gitkeep

storage/backups/*
!storage/backups/.gitkeep

storage/exports/*
!storage/exports/.gitkeep

storage/quarantine/*
!storage/quarantine/.gitkeep

storage/temp/*
!storage/temp/.gitkeep

public/uploads/*
!public/uploads/.gitkeep
“””,

    “server.js”: “””\
‘use strict’;

require(‘dotenv’).config();

const app = require(‘./app’);
const PORT = Number(process.env.PORT || 3000);

const server = app.listen(PORT, () => {
    console.log(`[COLLEGEYATRA] Server running on port ${PORT}`);
});

function shutdown(signal) {
    console.log(`${signal} received. Shutting down...`);

    server.close(() => {
        console.log(‘Server closed.’);
        process.exit(0);
    });

    setTimeout(() => process.exit(1), 10000).unref();
}

process.on(‘SIGTERM’, () => shutdown(‘SIGTERM’));
process.on(‘SIGINT’, () => shutdown(‘SIGINT’));
“””,

    “app.js”: “””\
‘use strict’;

const express = require(‘express’);
const helmet = require(‘helmet’);
const cors = require(‘cors’);

const healthRoutes = require(‘./routes/health.routes’);
const errorHandler = require(‘./middleware/error-handler’);

const app = express();

app.disable(‘x-powered-by’);
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || ‘http://localhost:3000’
}));
app.use(express.json({ limit: ‘1mb’ }));
app.use(express.urlencoded({ extended: true }));

app.get(‘/‘, (req, res) => {
    res.json({
        name: ‘COLLEGEYATRA’,
        status: ‘operational’
    });
});

app.use(‘/api/health’, healthRoutes);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: ‘Route not found’
    });
});

app.use(errorHandler);

module.exports = app;
“””,

    “config/database.js”: “””\
‘use strict’;

const { Pool } = require(‘pg’);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === ‘production’
        ? { rejectUnauthorized: true }
        : false
});

pool.on(‘error’, (error) => {
    console.error(‘Unexpected PostgreSQL error:’, error.message);
});

module.exports = pool;
“””,

    “routes/health.routes.js”: “””\
‘use strict’;

const router = require(‘express’).Router();

router.get(‘/‘, (req, res) => {
    res.status(200).json({
        success: true,
        service: ‘COLLEGEYATRA API’,
        status: ‘healthy’,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
“””,

    “middleware/error-handler.js”: “””\
‘use strict’;

module.exports = (error, req, res, next) => {
    console.error(error);

    if (res.headersSent) {
        return next(error);
    }

    const status = Number(error.status || error.statusCode) || 500;

    res.status(status).json({
        success: false,
        message: status >= 500
            ? ‘Internal server error’
            : error.message
    });
};
“””,

    “README.md”: “””\
# COLLEGEYATRA

Education consultancy and admission management platform.

## Technology

- Node.js 22+
- Express 5
- PostgreSQL
- HTML, CSS and JavaScript

## Installation

```bash
npm install
```

Copy `.env.example` to `.env` and configure your local settings.

## Start

```bash
npm run dev
```

## API Health

GET /api/health

## Testing

```bash
npm test
```

Never commit credentials, private student documents,
database backups or production exports.
“””,

    “tests/health.test.js”: “””\
‘use strict’;

const test = require(‘node:test’);
const assert = require(‘node:assert/strict’);

test(‘COLLEGEYATRA test environment is available’, () => {
    assert.equal(typeof process.version, ‘string’);
});
“””,

    “docs/architecture/README.md”: “””\
# Architecture

COLLEGEYATRA uses a modular architecture.

- Controllers: HTTP request handling
- Models: Data access
- Routes: API endpoints
- Services: Business logic
- Middleware: Request processing
- Validators: Input validation
- Database: PostgreSQL integration
- Integrations: External services
- Tests: Automated verification
“””
}


# ============================================================
# UTILITIES
# ============================================================

def find_root(path=None):
    if path:
        root = Path(path).expanduser().resolve()
        if not root.exists():
            raise FileNotFoundError(root)
        return root

    current = Path(__file__).resolve().parent

    for directory in [current, *current.parents]:
        if (directory / “.git”).exists():
            return directory

        if (directory / “package.json”).exists():
            return directory

    return current


def create_file(root, relative_path, content, dry_run=False):
    target = root / relative_path

    if target.exists():
        return “SKIPPED”

    if dry_run:
        return “PLANNED”

    target.parent.mkdir(parents=True, exist_ok=True)

    if isinstance(content, dict):
        data = json.dumps(content, indent=2) + “\n”
    else:
        data = content

    # Exclusive creation prevents accidental overwriting.
    try:
        with target.open(“x”, encoding=“utf-8”) as file:
            file.write(data)

        return “CREATED”

    except FileExistsError:
        return “SKIPPED”


def create_directory(root, relative_path, dry_run=False):
    target = root / relative_path

    if target.exists():
        return “EXISTS”

    if dry_run:
        return “PLANNED”

    target.mkdir(parents=True, exist_ok=True)
    return “CREATED”


# ============================================================
# MAIN GENERATOR
# ============================================================

def generate(root, dry_run=False):

    print(“\n======================================“)
    print(“ COLLEGEYATRA REPOSITORY BUILDER”)
    print(“======================================\n”)

    created = []
    skipped = []
    planned = []

    print(“[1/3] Creating directories...”)

    for directory in DIRECTORIES:
        result = create_directory(root, directory, dry_run)

        if result == “CREATED”:
            created.append(directory)
        elif result == “PLANNED”:
            planned.append(directory)

    # Add placeholders for protected storage directories.
    placeholders = [
        “storage/backups/.gitkeep”,
        “storage/documents/.gitkeep”,
        “storage/exports/.gitkeep”,
        “storage/quarantine/.gitkeep”,
        “storage/temp/.gitkeep”,
        “public/uploads/.gitkeep”,
    ]

    print(“[2/3] Creating files...”)

    all_files = dict(FILES)

    for placeholder in placeholders:
        all_files[placeholder] = “”

    for relative_path, content in all_files.items():
        result = create_file(
            root,
            relative_path,
            content,
            dry_run
        )

        if result == “CREATED”:
            created.append(relative_path)
            print(f”  [+] {relative_path}”)

        elif result == “SKIPPED”:
            skipped.append(relative_path)
            print(f”  [=] Preserved: {relative_path}”)

        else:
            planned.append(relative_path)
            print(f”  [?] Planned: {relative_path}”)

    print(“[3/3] Generating report...”)

    report = {
        “project”: PROJECT_NAME,
        “generated_at”: datetime.now().astimezone().isoformat(),
        “root”: str(root),
        “dry_run”: dry_run,
        “created”: created,
        “skipped”: skipped,
        “planned”: planned,
    }

    if not dry_run:
        report_path = root / “repository-generation-report.json”

        if not report_path.exists():
            report_path.write_text(
                json.dumps(report, indent=2),
                encoding=“utf-8”
            )
            print(“  [+] repository-generation-report.json”)
        else:
            print(“  [=] Existing report preserved”)

    print(“\n======================================“)
    print(“ GENERATION SUMMARY”)
    print(“======================================“)
    print(f”Created : {len(created)}”)
    print(f”Skipped : {len(skipped)}”)
    print(f”Planned : {len(planned)}”)
    print(f”Root    : {root}”)
    print(“======================================“)

    if dry_run:
        print(“\nDRY RUN: No files were modified.”)
    else:
        print(“\nRepository structure generation completed.”)

    return report


# ============================================================
# COMMAND LINE
# ============================================================

def main():

    parser = argparse.ArgumentParser(
        description=“COLLEGEYATRA automatic repository generator”
    )

    parser.add_argument(
        “—root”,
        help=“Repository directory (optional)”
    )

    parser.add_argument(
        “—dry-run”,
        action=“store_true”,
        help=“Preview changes without creating files”
    )

    args = parser.parse_args()

    try:
        root = find_root(args.root)

        print(f”\nRepository: {root}”)

        generate(root, dry_run=args.dry_run)

    except Exception as error:
        print(f”\n[FATAL] {error}”, file=sys.stderr)
        sys.exit(1)


if __name__ == “__main__”:
    main()
