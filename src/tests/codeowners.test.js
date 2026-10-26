'use strict';
/**
 * MedOrbits -- CODEOWNERS Validation Tests
 *
 * File: tests/codeowners.test.js
 *
 * Requirements:
 * - Node.js >= 20
 * - Jest
 * - Repository ownership file: .github/CODEOWNERS
 *
 * Validates:
 * - File existence, type, readability, UTF-8 encoding and line endings.
 * - Default repository ownership.
 * - Required repository and security-sensitive ownership rules.
 * - Rule parsing, owner syntax and formatting.
 * - Duplicate rules and conflicting mandatory ownership.
 * - Rule ordering and potentially ineffective mandatory rules.
 * - Common GitHub CODEOWNERS pattern restrictions.
 *
 * Limitations:
 * - This is a policy and structural validator, not a complete GitHub parser.
 * - It cannot confirm that users or teams exist or have repository access.
 * - Run a pull request on GitHub to verify actual CODEOWNERS behavior.
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
const REQUIRED_EXACT_RULES = [
  '*',
  '/src/',
  '/.github/',
  '/package.json',
];
const REQUIRED_SECURITY_RULES = [
  '/src/auth/',
  '/src/middleware/',
  '/src/validators/',
  '/src/controllers/',
  '/src/services/',
  '/src/repositories/',
];
const REQUIRED_RULES = [
  ...REQUIRED_EXACT_RULES,
  ...REQUIRED_SECURITY_RULES,
];
const MAX_CODEOWNERS_BYTES = 1024 * 1024;
/**
 * Expected rule policy.
 *
 * Set this to false if your repository intentionally permits additional
 * owners on mandatory rules. The default preserves your original policy.
 */
const REQUIRE_SINGLE_OWNER_ON_REQUIRED_RULES = true;
/**
 * Decode UTF-8 strictly so invalid byte sequences cannot silently become
 * replacement characters.
 */
function decodeUtf8(buffer) {
  return new TextDecoder('utf-8', {
    fatal: true,
  }).decode(buffer);
}
/**
 * Parse CODEOWNERS lines.
 *
 * In CODEOWNERS, comments should occupy their own lines.
 * A # inside a pattern must not automatically be treated as a comment.
 *
 * This parser checks structure; it does not implement GitHub's complete
 * pattern-matching engine.
 */
function parseCodeownersRules(source) {
  return source
    .split(/\r?\n/)
    .map((raw, index) => ({
      lineNumber: index + 1,
      raw,
      trimmed: raw.trim(),
    }))
    .filter(({ trimmed }) => {
      return trimmed.length > 0 && !trimmed.startsWith('#');
    })
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
 * Check the structural form of a GitHub user, organization/team reference,
 * or email owner.
 *
 * This is deliberately a syntax check only; it cannot verify that the
 * referenced account, organization, team or email is accepted by GitHub.
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
    const validSegment = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
    return parts.every((part) => validSegment.test(part));
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner);
}
/**
 * Patterns using these constructs are unsupported in GitHub CODEOWNERS.
 */
function hasUnsupportedPatternSyntax(pattern) {
  return (
    pattern.startsWith('!') ||
    /\[[^\]]*\]/.test(pattern) ||
    pattern.includes('\\')
  );
}
describe('MedOrbits CODEOWNERS', () => {
  let fileExists = false;
  let isRegularFile = false;
  let content = '';
  let rawBuffer = Buffer.alloc(0);
  let lines = [];
  let activeLines = [];
  let parsedRules = [];
  let readError = null;
  let statError = null;
  let decodeError = null;
  /**
   * Return all parsed rules matching an exact pattern.
   */
  function rulesForPattern(pattern) {
    return parsedRules.filter(
      (rule) => rule.pattern === pattern
    );
  }
  /**
   * Return whether a required pattern assigns the expected owner.
   */
  function hasOwnerRule(pattern, owner = EXPECTED_OWNER) {
    return parsedRules.some(
      (rule) =>
        rule.pattern === pattern &&
        rule.owners.includes(owner)
    );
  }
  /**
   * Return the last explicit rule for a pattern.
   *
   * GitHub uses the last matching rule for a file. This helper checks
   * duplicate exact patterns, but does not simulate arbitrary glob matches.
   */
  function lastRuleForPattern(pattern) {
    const matchingRules = rulesForPattern(pattern);
    return matchingRules.length
      ? matchingRules[matchingRules.length - 1]
      : undefined;
  }
  /**
   * Check whether a required pattern has exactly one rule and the intended
   * owner. Exact patterns are compared literally.
   */
  function requiredRuleHasExpectedPolicy(pattern) {
    const matchingRules = rulesForPattern(pattern);
    if (matchingRules.length !== 1) {
      return false;
    }
    const rule = matchingRules[0];
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
  beforeAll(() => {
    try {
      fileExists = fs.existsSync(CODEOWNERS_PATH);
      if (!fileExists) {
        return;
      }
      const stats = fs.statSync(CODEOWNERS_PATH);
      isRegularFile = stats.isFile();
      if (!isRegularFile) {
        return;
      }
      if (stats.size > MAX_CODEOWNERS_BYTES) {
        readError = new Error(
          `CODEOWNERS exceeds the ${MAX_CODEOWNERS_BYTES}-byte test limit.`
        );
        return;
      }
      rawBuffer = fs.readFileSync(CODEOWNERS_PATH);
      try {
        content = decodeUtf8(rawBuffer);
      } catch (error) {
        decodeError = error;
        return;
      }
      lines = content.split(/\r?\n/);
      activeLines = lines.filter((line) => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('#');
      });
      parsedRules = parseCodeownersRules(content);
    } catch (error) {
      readError = error;
    }
  });
  describe('File existence and readability', () => {
    test('CODEOWNERS file exists', () => {
      expect(fs.existsSync(CODEOWNERS_PATH)).toBe(true);
    });
    test('CODEOWNERS path points to a regular file', () => {
      expect(fileExists).toBe(true);
      expect(isRegularFile).toBe(true);
    });
    test('CODEOWNERS file can be read without filesystem errors', () => {
      expect(readError).toBeNull();
      expect(fileExists).toBe(true);
      expect(isRegularFile).toBe(true);
    });
    test('CODEOWNERS is valid UTF-8', () => {
      expect(decodeError).toBeNull();
      if (rawBuffer.length > 0) {
        expect(() => decodeUtf8(rawBuffer)).not.toThrow();
      }
    });
    test('CODEOWNERS is not empty or comment-only', () => {
      expect(content.trim().length).toBeGreaterThan(0);
      expect(activeLines.length).toBeGreaterThan(0);
      expect(parsedRules.length).toBeGreaterThan(0);
    });
    test('CODEOWNERS does not exceed the configured size limit', () => {
      expect(rawBuffer.length).toBeLessThanOrEqual(
        MAX_CODEOWNERS_BYTES
      );
    });
    test('CODEOWNERS contains no null bytes', () => {
      expect(content).not.toContain('\0');
    });
    test('CODEOWNERS contains no unexpected carriage returns', () => {
      expect(content).not.toMatch(/\r(?!\n)/);
    });
    test('CODEOWNERS has a final newline', () => {
      expect(content.endsWith('\n')).toBe(true);
    });
    test('CODEOWNERS is located under the expected .github directory', () => {
      expect(path.basename(CODEOWNERS_PATH)).toBe('CODEOWNERS');
      expect(
        path.basename(path.dirname(CODEOWNERS_PATH))
      ).toBe('.github');
    });
  });
  describe('Default repository ownership', () => {
    test('contains the correct default owner', () => {
      expect(content).toMatch(
        /^\*\s+@vivekchoubey444-del\s*$/m
      );
    });
    test('defines the default wildcard rule exactly once', () => {
      expect(rulesForPattern('*')).toHaveLength(1);
    });
    test('default wildcard rule assigns the expected owner', () => {
      const rule = lastRuleForPattern('*');
      expect(rule).toBeDefined();
      expect(rule.owners).toContain(EXPECTED_OWNER);
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
    test('default wildcard rule has the expected owner policy', () => {
      const rule = lastRuleForPattern('*');
      expect(rule).toBeDefined();
      expect(rule.owners).toEqual([EXPECTED_OWNER]);
    });
  });
  describe('Required repository ownership rules', () => {
    test('assigns ownership to the src directory', () => {
      expect(content).toMatch(
        /^\/src\/\s+@vivekchoubey444-del\s*$/m
      );
    });
    test('assigns ownership to GitHub configuration and workflows', () => {
      expect(content).toMatch(
        /^\/\.github\/\s+@vivekchoubey444-del\s*$/m
      );
    });
    test('assigns ownership to package.json', () => {
      expect(content).toMatch(
        /^\/package\.json\s+@vivekchoubey444-del\s*$/m
      );
    });
    test.each(REQUIRED_EXACT_RULES)(
      'contains the required rule: %s',
      (pattern) => {
        expect(hasOwnerRule(pattern)).toBe(true);
      }
    );
    test('every required exact rule is defined exactly once', () => {
      for (const pattern of REQUIRED_EXACT_RULES) {
        expect(rulesForPattern(pattern)).toHaveLength(1);
      }
    });
    test('every required exact rule has the expected ownership policy', () => {
      for (const pattern of REQUIRED_EXACT_RULES) {
        expect(
          requiredRuleHasExpectedPolicy(pattern)
        ).toBe(true);
      }
    });
    test('all required exact rules have valid line numbers', () => {
      for (const pattern of REQUIRED_EXACT_RULES) {
        const rule = lastRuleForPattern(pattern);
        expect(rule).toBeDefined();
        expect(rule.lineNumber).toBeGreaterThan(0);
      }
    });
  });
  describe('Security-sensitive component ownership', () => {
    test.each(REQUIRED_SECURITY_RULES)(
      'assigns ownership to %s',
      (pattern) => {
        expect(hasOwnerRule(pattern)).toBe(true);
      }
    );
    test('covers every required security-sensitive directory', () => {
      const missingRules = REQUIRED_SECURITY_RULES.filter(
        (pattern) => !hasOwnerRule(pattern)
      );
      expect(missingRules).toEqual([]);
    });
    test('security-sensitive rules appear after the default wildcard rule', () => {
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
    test('security-sensitive rules follow the required owner policy', () => {
      for (const pattern of REQUIRED_SECURITY_RULES) {
        expect(
          requiredRuleHasExpectedPolicy(pattern)
        ).toBe(true);
      }
    });
    test('security-sensitive rules do not contain duplicate exact patterns', () => {
      for (const pattern of REQUIRED_SECURITY_RULES) {
        expect(rulesForPattern(pattern)).toHaveLength(1);
      }
    });
  });
  describe('Rule syntax and structure', () => {
    test('every active rule has a pattern and at least one owner', () => {
      expect(parsedRules.length).toBeGreaterThan(0);
      for (const rule of parsedRules) {
        expect(rule.pattern.length).toBeGreaterThan(0);
        expect(rule.owners.length).toBeGreaterThan(0);
      }
    });
    test('every owner has a structurally valid reference', () => {
      const invalidOwners = [];
      for (const rule of parsedRules) {
        for (const owner of rule.owners) {
          if (!isValidOwner(owner)) {
            invalidOwners.push({
              line: rule.lineNumber,
              pattern: rule.pattern,
              owner,
            });
          }
        }
      }
      expect(invalidOwners).toEqual([]);
    });
    test('does not contain duplicate owner references within a rule', () => {
      for (const rule of parsedRules) {
        expect(new Set(rule.owners).size).toBe(
          rule.owners.length
        );
      }
    });
    test('does not contain duplicate exact patterns', () => {
      const patterns = parsedRules.map(
        (rule) => rule.pattern
      );
      const duplicates = patterns.filter(
        (pattern, index) => patterns.indexOf(pattern) !== index
      );
      expect(duplicates).toEqual([]);
    });
    test('does not contain unsupported pattern syntax', () => {
      const invalidPatterns = parsedRules
        .filter((rule) =>
          hasUnsupportedPatternSyntax(rule.pattern)
        )
        .map((rule) => ({
          line: rule.lineNumber,
          pattern: rule.pattern,
        }));
      expect(invalidPatterns).toEqual([]);
    });
    test('does not contain empty patterns', () => {
      for (const rule of parsedRules) {
        expect(rule.pattern.trim()).not.toBe('');
      }
    });
    test('does not contain empty owner tokens', () => {
      for (const rule of parsedRules) {
        expect(rule.owners.every(Boolean)).toBe(true);
      }
    });
    test('does not contain whitespace inside individual owner tokens', () => {
      for (const rule of parsedRules) {
        for (const owner of rule.owners) {
          expect(owner).not.toMatch(/\s/);
        }
      }
    });
    test('does not contain trailing whitespace on active lines', () => {
      for (const rule of parsedRules) {
        expect(rule.raw).not.toMatch(/[ \t]+$/);
      }
    });
    test('does not contain leading whitespace on active rules', () => {
      for (const rule of parsedRules) {
        expect(rule.raw).not.toMatch(/^[ \t]+/);
      }
    });
    test('does not contain duplicate normalized active lines', () => {
      const normalizedLines = parsedRules.map(
        (rule) => rule.normalized
      );
      expect(new Set(normalizedLines).size).toBe(
        normalizedLines.length
      );
    });
    test('does not contain malformed rules with only a pattern', () => {
      const malformedRules = parsedRules
        .filter((rule) => rule.tokens.length < 2)
        .map((rule) => ({
          line: rule.lineNumber,
          raw: rule.raw,
        }));
      expect(malformedRules).toEqual([]);
    });
  });
  describe('Required ownership policy integrity', () => {
    test('all mandatory rules are present', () => {
      const missingRules = REQUIRED_RULES.filter(
        (pattern) => rulesForPattern(pattern).length === 0
      );
      expect(missingRules).toEqual([]);
    });
    test('all mandatory rules assign the expected owner', () => {
      const incorrectRules = REQUIRED_RULES.filter(
        (pattern) => !hasOwnerRule(pattern)
      );
      expect(incorrectRules).toEqual([]);
    });
    test('all mandatory rules have exactly one declaration', () => {
      const duplicatedRules = REQUIRED_RULES.filter(
        (pattern) => rulesForPattern(pattern).length !== 1
      );
      expect(duplicatedRules).toEqual([]);
    });
    test('mandatory rules do not contain unexpected additional owners', () => {
      if (!REQUIRE_SINGLE_OWNER_ON_REQUIRED_RULES) {
        return;
      }
      const violations = [];
      for (const pattern of REQUIRED_RULES) {
        const rules = rulesForPattern(pattern);
        for (const rule of rules) {
          if (
            rule.owners.length !== 1 ||
            rule.owners[0] !== EXPECTED_OWNER
          ) {
            violations.push({
              line: rule.lineNumber,
              pattern,
              owners: rule.owners,
            });
          }
        }
      }
      expect(violations).toEqual([]);
    });
    test('the default-owner declaration is not duplicated', () => {
      const defaultRules = parsedRules.filter(
        (rule) => rule.pattern === '*'
      );
      expect(defaultRules).toHaveLength(1);
    });
    test('required rules are not overridden by duplicate exact patterns', () => {
      const violations = [];
      for (const pattern of REQUIRED_RULES) {
        const rules = rulesForPattern(pattern);
        if (rules.length !== 1) {
          violations.push({
            pattern,
            count: rules.length,
          });
        }
      }
      expect(violations).toEqual([]);
    });
  });
  describe('Comments and formatting', () => {
    test('comment-only lines are ignored when parsing ownership rules', () => {
      const commentOnlyLines = lines.filter(
        (line) => line.trim().startsWith('#')
      );
      for (const line of commentOnlyLines) {
        expect(
          parseCodeownersRules(line)
        ).toHaveLength(0);
      }
    });
    test('blank lines are ignored when parsing ownership rules', () => {
      expect(parseCodeownersRules('')).toEqual([]);
      expect(parseCodeownersRules('\n')).toEqual([]);
      expect(parseCodeownersRules('   \n')).toEqual([]);
    });
    test('the parsed rule count matches the active line count', () => {
      expect(parsedRules).toHaveLength(activeLines.length);
    });
    test('all parsed rules have positive line numbers', () => {
      for (const rule of parsedRules) {
        expect(Number.isInteger(rule.lineNumber)).toBe(true);
        expect(rule.lineNumber).toBeGreaterThan(0);
      }
    });
    test('all mandatory patterns have a single owner reference', () => {
      for (const pattern of REQUIRED_RULES) {
        const rule = lastRuleForPattern(pattern);
        expect(rule).toBeDefined();
        expect(rule.owners).toContain(EXPECTED_OWNER);
      }
    });
  });
  describe('Regression and diagnostics', () => {
    test('the expected owner constant is a valid owner reference', () => {
      expect(isValidOwner(EXPECTED_OWNER)).toBe(true);
    });
    test('the configured path is absolute', () => {
      expect(path.isAbsolute(CODEOWNERS_PATH)).toBe(true);
    });
    test('every required rule has a positive line number', () => {
      for (const pattern of REQUIRED_RULES) {
        const rule = lastRuleForPattern(pattern);
        expect(rule).toBeDefined();
        expect(rule.lineNumber).toBeGreaterThan(0);
      }
    });
    test('the parser preserves each rule pattern', () => {
      for (const rule of parsedRules) {
        expect(rule.normalized.split(/\s+/)[0]).toBe(
          rule.pattern
        );
      }
    });
    test('the parser preserves all owner tokens', () => {
      for (const rule of parsedRules) {
        expect(rule.normalized.split(/\s+/).slice(1)).toEqual(
          rule.owners
        );
      }
    });
    test('required-rule configuration contains no duplicate patterns', () => {
      expect(new Set(REQUIRED_RULES).size).toBe(
        REQUIRED_RULES.length
      );
    });
    test('security-sensitive configuration contains no duplicate patterns', () => {
      expect(new Set(REQUIRED_SECURITY_RULES).size).toBe(
        REQUIRED_SECURITY_RULES.length
      );
    });
  });
});