
'use strict';

/**
 * =============================================================================
 * MedOrbits API -- Repository Validation
 * File: /api/scripts/check.js
 * Version: 2.1.1
 *
 * Checks:
 *   1. JavaScript syntax using the current Node.js executable.
 *   2. JSON syntax using JSON.parse().
 *   3. Filesystem traversal errors.
 *   4. Child-process execution errors.
 *
 * Supported JavaScript:
 *   .js
 *   .cjs
 *   .mjs
 *
 * Supported data:
 *   .json
 *
 * Safety:
 *   - Read-only validation.
 *   - Does not modify source files.
 *   - Does not follow symbolic links.
 *   - Does not install dependencies.
 *   - Does not execute application code.
 *
 * =============================================================================
 */

// =============================================================================
// DEPENDENCIES
// =============================================================================

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// =============================================================================
// CONFIGURATION
// =============================================================================

const ROOT = path.resolve(__dirname, '..');

const SKIP_DIRECTORIES = new Set([
    '.git',
    '.github',
    '.husky',
    '.vscode',
    'node_modules',
    'coverage',
    'dist',
    'build',
    'out',
    'tmp',
    'temp',
    '.cache',
    '.next',
    '.nuxt',
    '.output',
    '.turbo',
    '.vercel',
    '.serverless',
    '__pycache__',
    '.pytest_cache',
    '.ruff_cache',
    '.venv',
    'venv',
]);

const JAVASCRIPT_EXTENSIONS = new Set([
    '.js',
    '.cjs',
    '.mjs',
]);

const JSON_EXTENSION = '.json';

const MAX_BUFFER_BYTES = 10 * 1024 * 1024;

// =============================================================================
// STATE
// =============================================================================

const stats = {
    checked: 0,
    javascript: 0,
    json: 0,
    skipped: 0,
    failures: 0,
};

// =============================================================================
// OUTPUT
// =============================================================================

function relativeFile(filePath) {
    return path.relative(ROOT, filePath) || '.';
}

function reportFailure(filePath, message) {
    stats.failures++;

    process.stderr.write(
        `\n[FAIL] ${relativeFile(filePath)}\n${message}\n`
    );
}

function reportWarning(message) {
    process.stderr.write(`[WARN] ${message}\n`);
}

// =============================================================================
// FILE TYPE VALIDATION
// =============================================================================

function isJavaScriptFile(filePath) {
    return JAVASCRIPT_EXTENSIONS.has(
        path.extname(filePath).toLowerCase()
    );
}

function isJsonFile(filePath) {
    return (
        path.extname(filePath).toLowerCase() === JSON_EXTENSION
    );
}

// =============================================================================
// JAVASCRIPT VALIDATION
// =============================================================================

function checkJavaScript(filePath) {
    stats.checked++;
    stats.javascript++;

    const result = spawnSync(
        process.execPath,
        ['--check', filePath],
        {
            encoding: 'utf8',
            maxBuffer: MAX_BUFFER_BYTES,
            windowsHide: true,
            timeout: 30000,
        }
    );

    if (result.error) {
        reportFailure(
            filePath,
            `Unable to execute Node.js syntax check: ${result.error.message}`
        );

        return;
    }

    if (result.status !== 0) {
        const output = [
            result.stderr,
            result.stdout,
        ]
            .filter(Boolean)
            .join('\n')
            .trim();

        reportFailure(
            filePath,
            output || `Node.js exited with status ${result.status}.`
        );

        return;
    }

    if (result.signal) {
        reportFailure(
            filePath,
            `Syntax checker terminated by signal: ${result.signal}`
        );
    }
}

// =============================================================================
// JSON VALIDATION
// =============================================================================

function checkJson(filePath) {
    stats.checked++;
    stats.json++;

    try {
        const content = fs.readFileSync(
            filePath,
            'utf8'
        );

        JSON.parse(content);
    } catch (error) {
        reportFailure(
            filePath,
            `Invalid or unreadable JSON: ${error.message}`
        );
    }
}

// =============================================================================
// DIRECTORY TRAVERSAL
// =============================================================================

function walk(directory) {
    let entries;

    try {
        entries = fs.readdirSync(
            directory,
            {
                withFileTypes: true,
            }
        );
    } catch (error) {
        reportFailure(
            directory,
            `Unable to read directory: ${error.message}`
        );

        return;
    }

    for (const entry of entries) {
        const fullPath = path.join(
            directory,
            entry.name
        );

        if (entry.isSymbolicLink()) {
            stats.skipped++;
            continue;
        }

        if (entry.isDirectory()) {
            if (SKIP_DIRECTORIES.has(entry.name)) {
                stats.skipped++;
                continue;
            }

            walk(fullPath);

            continue;
        }

        if (!entry.isFile()) {
            stats.skipped++;
            continue;
        }

        if (isJavaScriptFile(fullPath)) {
            checkJavaScript(fullPath);

            continue;
        }

        if (isJsonFile(fullPath)) {
            checkJson(fullPath);

            continue;
        }

        stats.skipped++;
    }
}

// =============================================================================
// SUMMARY
// =============================================================================

function printSummary() {
    console.log('\n==============================================');
    console.log(' MedOrbits API - Validation Summary');
    console.log('==============================================');

    console.log(`Root:              ${ROOT}`);
    console.log(`Node.js:           ${process.version}`);
    console.log(`JavaScript files:  ${stats.javascript}`);
    console.log(`JSON files:        ${stats.json}`);
    console.log(`Total checked:     ${stats.checked}`);
    console.log(`Skipped entries:   ${stats.skipped}`);
    console.log(`Failures:          ${stats.failures}`);

    console.log('==============================================');

    if (stats.failures === 0) {
        console.log('[PASS] All checked files are valid.');
    } else {
        console.error(
            `[FAIL] Validation found ${stats.failures} failure(s).`
        );
    }

    console.log('==============================================\n');
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
    console.log('[MedOrbits] Starting API repository validation...');
    console.log(`[MedOrbits] Root directory: ${ROOT}`);

    if (!fs.existsSync(ROOT)) {
        reportFailure(
            ROOT,
            'API root directory does not exist.'
        );

        printSummary();

        process.exitCode = 1;

        return;
    }

    if (!fs.statSync(ROOT).isDirectory()) {
        reportFailure(
            ROOT,
            'API root path is not a directory.'
        );

        printSummary();

        process.exitCode = 1;

        return;
    }

    if (Number(process.versions.node.split('.')[0]) < 22) {
        reportWarning(
            'This project expects Node.js >=22.0.0.'
        );
    }

    walk(ROOT);

    printSummary();

    process.exitCode = stats.failures > 0 ? 1 : 0;
}

// =============================================================================
// EXECUTION
// =============================================================================

try {
    main();
} catch (error) {
    console.error(
        '[MedOrbits] Fatal validation error:',
        error.message
    );

    process.exitCode = 1;
}
