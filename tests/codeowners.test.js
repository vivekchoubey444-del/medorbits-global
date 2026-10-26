
'use strict';

/**
 * MedOrbits -- CODEOWNERS Validation Tests
 *
 * File: tests/codeowners.test.js
 * Runtime: Node.js >= 20
 * Test framework: Jest
 *
 * Validates:
 * - CODEOWNERS existence, file type, UTF-8, size and line endings.
 * - Default repository ownership.
 * - Required repository and security-sensitive ownership rules.
 * - Owner-reference syntax and rule formatting.
 * - Duplicate patterns and conflicting required ownership.
 * - Unsupported CODEOWNERS pattern constructs.
 * - Required rule ordering.
 *
 * Limitations:
 * - This is a structural and policy validator, not a complete
 *   implementation of GitHub's CODEOWNERS matching engine.
 * - It cannot verify GitHub usernames, team existence, repository
 *   permissions, branch protection, or review assignment.
 * - Actual behavior must be verified in GitHub.
 */

const fs = require('node:fs');
const path = require('node:path');
const { TextDecoder } = require('node:util');

const EXPECTED_OWNER = '@vivekchoubey444-del';

const CODEOWNERS_PATH = path.resolve(
  __dirname,
  '..',
  '.github',
  'CODEOWNERS'
);

const MAX_CODEOWNERS_BYTES = 1024 * 1024;

const REQUIRED_EXACT_RULES = Object.freeze([
  '*',
  '/src/',
  '/.github/',
  '/package.json',
]);

const REQUIRED_SECURITY_RULES = Object.freeze([
  '/src/auth/',
  '/src/middleware/',
  '/src/validators/',
  '/src/controllers/',
  '/src/services/',
  '/src/repositories/',
]);

const REQUIRED_RULES = Object.freeze([
  ...REQUIRED_EXACT_RULES,
  ...REQUIRED_SECURITY_RULES,
]);

const REQUIRE_SINGLE_OWNER_ON_REQUIRED_RULES = true;

const OWNER_SEGMENT_PATTERN =
  /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;

const EMAIL_OWNER_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Decode UTF-8 strictly.
 */
function decodeUtf8(buffer) {
  return new TextDecoder('utf-8', {
    fatal: true,
  }).decode(buffer);
}

/**
 * Parse CODEOWNERS rules.
 *
 * Full-line comments and blank lines are ignored.
 * This parser deliberately does not claim to implement GitHub's
 * complete CODEOWNERS or gitignore pattern-matching semantics.
 */
function parseCodeownersRules(source) {
  if (typeof source !== 'string') {
    throw new TypeError('CODEOWNERS source must be a string.');
  }

  return source
    .split(/\r?\n/)
    .map((raw, index) => ({
      lineNumber: index + 1,
      raw,
      trimmed: raw.trim(),
    }))
    .filter(({ trimmed }) => (
      trimmed.length > 0 &&
      !trimmed.startsWith('#')
    ))
    .map(({ lineNumber, raw, trimmed }) => {
      const tokens = trimmed.split(/\s+/);

      return {
        lineNumber,
        raw,
        normalized: tokens.join(' '),
        pattern: tokens[0],
        owners: tokens.slice(1),
        tokens,
      };
    });
}

/**
 * Validate a GitHub-style owner reference syntactically.
 *
 * This does not establish whether the account or team exists.
 */
function isValidOwner(owner) {
  if (typeof owner !== 'string' || owner.length === 0) {
    return false;
  }

  if (owner.startsWith('@')) {
    const reference = owner.slice(1);

    if (!reference || /\s/.test(reference)) {
      return false;
    }

    const parts = reference.split('/');

    if (parts.length > 2) {
      return false;
    }

    return parts.every((part) =>
      OWNER_SEGMENT_PATTERN.test(part)
    );
  }

  return EMAIL_OWNER_PATTERN.test(owner);
}

/**
 * Reject pattern constructs unsupported by GitHub CODEOWNERS.
 *
 * GitHub does not support negation or character ranges in CODEOWNERS
 * patterns. Backslash escaping is also not supported as it is in some
 * other pattern-matching contexts.
 */
function hasUnsupportedPatternSyntax(pattern) {
  if (typeof pattern !== 'string' || pattern.length === 0) {
    return true;
  }

  return (
    pattern.startsWith('!') ||
    /[[\]]/.test(pattern) ||
    pattern.includes('\\')
  );
}

/**
 * Validate the structure of a CODEOWNERS pattern.
 *
 * This is a conservative structural check, not a GitHub glob engine.
 */
function isStructurallyValidPattern(pattern) {
  if (
    typeof pattern !== 'string' ||
    pattern.length === 0 ||
    /\s/.test(pattern) ||
    pattern.includes('\0') ||
    hasUnsupportedPatternSyntax(pattern)
  ) {
    return false;
  }

  return true;
}

/**
 * Read the CODEOWNERS file without allowing a missing file or read error
 * to become a misleading empty successful test fixture.
 */
function readCodeownersFile() {
  const result = {
    exists: false,
    regularFile: false,
    readable: false,
    content: '',
    buffer: Buffer.alloc(0),
    decodeError: null,
    readError: null,
    statError: null,
  };

  try {
    const stats = fs.statSync(CODEOWNERS_PATH);
    result.exists = true;
    result.regularFile = stats.isFile();

    if (!result.regularFile) {
      return result;
    }

    if (stats.size > MAX_CODEOWNERS_BYTES) {
      result.readError = new Error(
        `CODEOWNERS exceeds ${MAX_CODEOWNERS_BYTES} bytes.`
      );
      return result;
    }

    result.buffer = fs.readFileSync(CODEOWNERS_PATH);

    if (result.buffer.length > MAX_CODEOWNERS_BYTES) {
      result.readError = new Error(
        `CODEOWNERS exceeds ${MAX_CODEOWNERS_BYTES} bytes.`
      );
      return result;
    }

    result.readable = true;

    try {
      result.content = decodeUtf8(result.buffer);
    } catch (error) {
      result.decodeError = error;
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      result.exists = false;
    } else if (
      error.code === 'EACCES' ||
      error.code === 'EPERM'
    ) {
      result.readError = error;
    } else {
      result.statError = error;
    }
  }

  return result;
}

describe('MedOrbits CODEOWNERS', () => {
  let file;
  let lines;
  let activeLines;
  let parsedRules;

  beforeAll(() => {
    file = readCodeownersFile();

    lines = file.content.split(/\r?\n/);

    activeLines = lines.filter((line) => {
      const trimmed = line.trim();

      return (
        trimmed.length > 0 &&
        !trimmed.startsWith('#')
      );
    });

    parsedRules = parseCodeownersRules(file.content);
  });

  function rulesForPattern(pattern) {
    return parsedRules.filter(
      (rule) => rule.pattern === pattern
    );
  }

  function lastRuleForPattern(pattern) {
    const matches = rulesForPattern(pattern);

    return matches.length
      ? matches[matches.length - 1]
      : undefined;
  }

  function hasOwnerRule(pattern, owner = EXPECTED_OWNER) {
    return parsedRules.some(
      (rule) =>
        rule.pattern === pattern &&
        rule.owners.includes(owner)
    );
  }

  function requiredRuleHasExpectedPolicy(pattern) {
    const matches = rulesForPattern(pattern);

    if (matches.length !== 1) {
      return false;
    }

    const rule = matches[0];

    if (!rule.owners.includes(EXPECTED_OWNER)) {
      return false;
    }

    if (
      REQUIRE_SINGLE_OWNER_ON_REQUIRED_RULES &&
      rule.owners.length !== 1
    ) {
      return false;
    }

    return true;
  }

  describe('File existence and readability', () => {
    test('CODEOWNERS exists', () => {
      expect(file.exists).toBe(true);
    });

    test('CODEOWNERS is a regular file', () => {
      expect(file.regularFile).toBe(true);
    });

    test('CODEOWNERS is readable', () => {
      expect(file.readable).toBe(true);
      expect(file.readError).toBeNull();
      expect(file.statError).toBeNull();
    });

    test('CODEOWNERS is valid UTF-8', () => {
      expect(file.decodeError).toBeNull();

      if (file.readable) {
        expect(() => decodeUtf8(file.buffer)).not.toThrow();
      }
    });

    test('CODEOWNERS is not empty or comment-only', () => {
      expect(file.content.trim().length).toBeGreaterThan(0);
      expect(activeLines.length).toBeGreaterThan(0);
      expect(parsedRules.length).toBeGreaterThan(0);
    });

    test('CODEOWNERS does not exceed the size limit', () => {
      expect(file.buffer.length).toBeLessThanOrEqual(
        MAX_CODEOWNERS_BYTES
      );
    });

    test('CODEOWNERS contains no null bytes', () => {
      expect(file.content).not.toContain('\0');
    });

    test('CODEOWNERS contains no bare carriage returns', () => {
      expect(file.content).not.toMatch(/\r(?!\n)/);
    });

    test('CODEOWNERS ends with a newline', () => {
      expect(file.content.endsWith('\n')).toBe(true);
    });

    test('CODEOWNERS is in the expected directory', () => {
      expect(path.basename(CODEOWNERS_PATH)).toBe('CODEOWNERS');

      expect(
        path.basename(path.dirname(CODEOWNERS_PATH))
      ).toBe('.github');
    });

    test('CODEOWNERS path is absolute', () => {
      expect(path.isAbsolute(CODEOWNERS_PATH)).toBe(true);
    });
  });

  describe('Default repository ownership', () => {
    test('contains the expected default owner rule', () => {
      expect(
        parsedRules.some(
          (rule) =>
            rule.pattern === '*' &&
            rule.owners.includes(EXPECTED_OWNER)
        )
      ).toBe(true);
    });

    test('default wildcard rule appears exactly once', () => {
      expect(rulesForPattern('*')).toHaveLength(1);
    });

    test('default wildcard rule has the expected owner policy', () => {
      const rule = lastRuleForPattern('*');

      expect(rule).toBeDefined();
      expect(rule.owners).toEqual([EXPECTED_OWNER]);
    });

    test('default wildcard rule appears before required specific rules', () => {
      const defaultRule = lastRuleForPattern('*');

      expect(defaultRule).toBeDefined();

      for (const pattern of REQUIRED_RULES.filter(
        (item) => item !== '*'
      )) {
        const rule = lastRuleForPattern(pattern);

        expect(rule).toBeDefined();

        expect(rule.lineNumber).toBeGreaterThan(
          defaultRule.lineNumber
        );
      }
    });
  });

  describe('Required repository ownership', () => {
    test.each(REQUIRED_EXACT_RULES)(
      'contains exactly one required rule for %s',
      (pattern) => {
        expect(rulesForPattern(pattern)).toHaveLength(1);
      }
    );

    test.each(REQUIRED_EXACT_RULES)(
      'assigns the required owner policy to %s',
      (pattern) => {
        expect(
          requiredRuleHasExpectedPolicy(pattern)
        ).toBe(true);
      }
    );

    test('all required exact rules exist', () => {
      const missing = REQUIRED_EXACT_RULES.filter(
        (pattern) => rulesForPattern(pattern).length === 0
      );

      expect(missing).toEqual([]);
    });
  });

  describe('Security-sensitive ownership', () => {
    test.each(REQUIRED_SECURITY_RULES)(
      'contains a rule for %s',
      (pattern) => {
        expect(hasOwnerRule(pattern)).toBe(true);
      }
    );

    test('all security-sensitive rules have the required policy', () => {
      const violations = REQUIRED_SECURITY_RULES.filter(
        (pattern) => !requiredRuleHasExpectedPolicy(pattern)
      );

      expect(violations).toEqual([]);
    });

    test('security rules appear after the default wildcard', () => {
      const defaultRule = lastRuleForPattern('*');

      expect(defaultRule).toBeDefined();

      for (const pattern of REQUIRED_SECURITY_RULES) {
        const rule = lastRuleForPattern(pattern);

        expect(rule).toBeDefined();

        expect(rule.lineNumber).toBeGreaterThan(
          defaultRule.lineNumber
        );
      }
    });
  });

  describe('Rule syntax and structure', () => {
    test('every active rule has at least one owner', () => {
      expect(parsedRules.length).toBeGreaterThan(0);

      for (const rule of parsedRules) {
        expect(rule.pattern.length).toBeGreaterThan(0);
        expect(rule.owners.length).toBeGreaterThan(0);
      }
    });

    test('every pattern has structurally supported syntax', () => {
      const invalid = parsedRules
        .filter(
          (rule) => !isStructurallyValidPattern(rule.pattern)
        )
        .map((rule) => ({
          line: rule.lineNumber,
          pattern: rule.pattern,
        }));

      expect(invalid).toEqual([]);
    });

    test('every owner reference is syntactically valid', () => {
      const invalid = [];

      for (const rule of parsedRules) {
        for (const owner of rule.owners) {
          if (!isValidOwner(owner)) {
            invalid.push({
              line: rule.lineNumber,
              pattern: rule.pattern,
              owner,
            });
          }
        }
      }

      expect(invalid).toEqual([]);
    });

    test('owner references are unique within each rule', () => {
      for (const rule of parsedRules) {
        expect(new Set(rule.owners).size).toBe(
          rule.owners.length
        );
      }
    });

    test('there are no duplicate exact patterns', () => {
      const patterns = parsedRules.map(
        (rule) => rule.pattern
      );

      expect(new Set(patterns).size).toBe(patterns.length);
    });

    test('active lines contain no trailing whitespace', () => {
      for (const rule of parsedRules) {
        expect(rule.raw).not.toMatch(/[ \t]+$/);
      }
    });

    test('active rules contain no leading whitespace', () => {
      for (const rule of parsedRules) {
        expect(rule.raw).not.toMatch(/^[ \t]+/);
      }
    });

    test('active lines contain no duplicate normalized rules', () => {
      const normalized = parsedRules.map(
        (rule) => rule.normalized
      );

      expect(new Set(normalized).size).toBe(normalized.length);
    });

    test('every rule has a positive line number', () => {
      for (const rule of parsedRules) {
        expect(Number.isInteger(rule.lineNumber)).toBe(true);
        expect(rule.lineNumber).toBeGreaterThan(0);
      }
    });
  });

  describe('Required ownership integrity', () => {
    test('all mandatory patterns are present', () => {
      const missing = REQUIRED_RULES.filter(
        (pattern) => rulesForPattern(pattern).length === 0
      );

      expect(missing).toEqual([]);
    });

    test('all mandatory patterns assign the expected owner', () => {
      const incorrect = REQUIRED_RULES.filter(
        (pattern) => !hasOwnerRule(pattern)
      );

      expect(incorrect).toEqual([]);
    });

    test('all mandatory patterns follow the configured owner policy', () => {
      const violations = REQUIRED_RULES.filter(
        (pattern) => !requiredRuleHasExpectedPolicy(pattern)
      );

      expect(violations).toEqual([]);
    });

    test('required rule configuration has no duplicate patterns', () => {
      expect(new Set(REQUIRED_RULES).size).toBe(
        REQUIRED_RULES.length
      );
    });

    test('security rule configuration has no duplicate patterns', () => {
      expect(new Set(REQUIRED_SECURITY_RULES).size).toBe(
        REQUIRED_SECURITY_RULES.length
      );
    });

    test('the expected owner is syntactically valid', () => {
      expect(isValidOwner(EXPECTED_OWNER)).toBe(true);
    });
  });

  describe('Parser regression tests', () => {
    test('ignores full-line comments', () => {
      expect(
        parseCodeownersRules('# comment\n').length
      ).toBe(0);
    });

    test('ignores blank lines', () => {
      expect(parseCodeownersRules('').length).toBe(0);
      expect(parseCodeownersRules('\n').length).toBe(0);
      expect(parseCodeownersRules('   \n').length).toBe(0);
    });

    test('preserves pattern and owner tokens', () => {
      const sample = '* @example-owner\n';
      const parsed = parseCodeownersRules(sample);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].pattern).toBe('*');
      expect(parsed[0].owners).toEqual(['@example-owner']);
    });

    test('records accurate source line numbers', () => {
      const parsed = parseCodeownersRules(
        '# heading\n\n* @example-owner\n/src/ @example-owner\n'
      );

      expect(parsed.map((rule) => rule.lineNumber)).toEqual([
        3,
        4,
      ]);
    });

    test('rejects malformed owner references', () => {
      expect(isValidOwner('')).toBe(false);
      expect(isValidOwner('@')).toBe(false);
      expect(isValidOwner('@org/')).toBe(false);
      expect(isValidOwner('@org/team/extra')).toBe(false);
      expect(isValidOwner('@bad owner')).toBe(false);
      expect(isValidOwner('not-an-email')).toBe(false);
    });

    test('accepts structurally valid owner references', () => {
      expect(isValidOwner('@example-user')).toBe(true);
      expect(isValidOwner('@example-org/example-team')).toBe(true);
      expect(isValidOwner('owner@example.com')).toBe(true);
    });

    test('detects unsupported pattern constructs', () => {
      expect(hasUnsupportedPatternSyntax('!private/')).toBe(true);
      expect(hasUnsupportedPatternSyntax('/src/[ab].js')).toBe(true);
      expect(hasUnsupportedPatternSyntax('/src/file\\name')).toBe(true);
      expect(hasUnsupportedPatternSyntax('/src/')).toBe(false);
      expect(hasUnsupportedPatternSyntax('*')).toBe(false);
    });

    test('rejects non-string parser input', () => {
      expect(() => parseCodeownersRules(null)).toThrow(TypeError);
      expect(() => parseCodeownersRules({})).toThrow(TypeError);
    });
  });
});
