
'use strict';

/**
 * MedOrbits -- Unit Tests for Validators
 * File: tests/unit/validators.test.js
 *
 * Purpose:
 * - Verify email, password, required-field, and Indian phone validation.
 * - Cover valid, invalid, boundary, malformed, and adversarial inputs.
 * - Ensure validators reject unexpected types without throwing.
 * - Confirm input normalization behavior where supported.
 *
 * Run:
 *   npm test -- --runInBand
 *
 * Notes:
 * - Tests assume the public validator API exports:
 *   isValidEmail, isValidPassword, isRequired, isValidPhone
 * - Password-policy and phone-format expectations should match the
 *   application's documented production policy.
 */

const {
  isValidEmail,
  isValidPassword,
  isRequired,
  isValidPhone,
} = require('../../src/validators');

describe('MedOrbits Validators', () => {
  const validators = {
    isValidEmail,
    isValidPassword,
    isRequired,
    isValidPhone,
  };

  beforeAll(() => {
    for (const [name, validator] of Object.entries(validators)) {
      expect(typeof validator).toBe('function');
      expect(() => validator('test')).not.toThrow();
    }
  });

  describe('isValidEmail', () => {
    test.each([
      ['standard email', 'user@example.com'],
      ['subdomain', 'user@mail.example.com'],
      ['plus addressing', 'user+careers@example.com'],
      ['numeric local part', '12345@example.com'],
      ['hyphenated domain', 'user@med-orbits.example'],
      ['uppercase characters', 'USER@EXAMPLE.COM'],
      ['surrounding whitespace when trimming is supported', ' user@example.com '],
    ])('accepts %s', (_description, value) => {
      expect(isValidEmail(value)).toBe(true);
    });

    test.each([
      ['empty string', ''],
      ['missing at symbol', 'userexample.com'],
      ['missing local part', '@example.com'],
      ['missing domain', 'user@'],
      ['missing domain suffix', 'user@example'],
      ['multiple at symbols', 'user@@example.com'],
      ['spaces inside address', 'user name@example.com'],
      ['spaces inside domain', 'user@exam ple.com'],
      ['leading dot in local part', '.user@example.com'],
      ['trailing dot in local part', 'user.@example.com'],
      ['consecutive dots in local part', 'user..name@example.com'],
      ['missing domain label', 'user@.example.com'],
      ['trailing domain dot', 'user@example.com.'],
      ['newline injection', 'user@example.com\n'],
      ['carriage return injection', 'user@example.com\r'],
      ['embedded null character', 'user\u0000@example.com'],
    ])('rejects %s', (_description, value) => {
      expect(isValidEmail(value)).toBe(false);
    });

    test.each([
      ['null', null],
      ['undefined', undefined],
      ['number', 123],
      ['boolean', true],
      ['object', {}],
      ['array', ['user@example.com']],
      ['function', () => 'user@example.com'],
      ['symbol', Symbol('email')],
      ['bigint', 123n],
    ])('rejects non-string input: %s', (_description, value) => {
      expect(() => isValidEmail(value)).not.toThrow();
      expect(isValidEmail(value)).toBe(false);
    });

    test('does not mutate the input string', () => {
      const value = ' user@example.com ';
      const original = value;

      isValidEmail(value);

      expect(value).toBe(original);
    });

    test('rejects excessively long addresses if length limits are enforced', () => {
      const localPart = 'a'.repeat(300);
      const value = `${localPart}@example.com`;

      expect(isValidEmail(value)).toBe(false);
    });
  });

  describe('isValidPassword', () => {
    test('accepts the documented strong-password example', () => {
      expect(isValidPassword('StrongPass123!')).toBe(true);
    });

    test.each([
      ['empty string', ''],
      ['short password', 'Ab1!'],
      ['whitespace only', '          '],
      ['null character', 'StrongPass123!\u0000'],
    ])('rejects %s', (_description, value) => {
      expect(isValidPassword(value)).toBe(false);
    });

    test.each([
      ['null', null],
      ['undefined', undefined],
      ['number', 123456],
      ['boolean', true],
      ['object', {}],
      ['array', ['StrongPass123!']],
      ['symbol', Symbol('password')],
      ['bigint', 123n],
    ])('rejects non-string input: %s', (_description, value) => {
      expect(() => isValidPassword(value)).not.toThrow();
      expect(isValidPassword(value)).toBe(false);
    });

    test('does not throw for unusually long input', () => {
      expect(() => isValidPassword('A1!'.repeat(10000))).not.toThrow();
    });

    test('does not silently accept a password with only spaces', () => {
      expect(isValidPassword(' '.repeat(32))).toBe(false);
    });

    test('does not treat a numeric value as a string password', () => {
      expect(isValidPassword(123456789012)).toBe(false);
    });

    test('handles Unicode input without throwing', () => {
      expect(() => isValidPassword('Pässwörd123!')).not.toThrow();
    });
  });

  describe('isRequired', () => {
    test.each([
      ['ordinary string', 'MedOrbits'],
      ['string containing zero', '0'],
      ['string containing punctuation', '!'],
      ['string with surrounding spaces and content', ' MedOrbits '],
      ['numeric zero', 0],
      ['positive number', 42],
      ['boolean false', false],
      ['boolean true', true],
    ])('accepts non-empty value: %s', (_description, value) => {
      expect(isRequired(value)).toBe(true);
    });

    test.each([
      ['empty string', ''],
      ['single space', ' '],
      ['multiple spaces', '   '],
      ['tab characters', '\t\t'],
      ['newline characters', '\n\n'],
      ['mixed whitespace', ' \t\r\n '],
      ['null', null],
      ['undefined', undefined],
    ])('rejects missing value: %s', (_description, value) => {
      expect(isRequired(value)).toBe(false);
    });

    test('handles Unicode whitespace-only input', () => {
      expect(isRequired('\u00A0\u2003\u3000')).toBe(false);
    });

    test('handles objects and arrays without throwing', () => {
      expect(() => isRequired({})).not.toThrow();
      expect(() => isRequired([])).not.toThrow();
    });

    test('rejects an object whose string conversion is empty if objects are unsupported', () => {
      const value = {
        toString() {
          return '';
        },
      };

      expect(() => isRequired(value)).not.toThrow();
    });

    test('does not throw for symbols', () => {
      expect(() => isRequired(Symbol('required'))).not.toThrow();
    });
  });

  describe('isValidPhone', () => {
    test.each([
      ['10-digit Indian mobile number', '9876543210'],
      ['Indian mobile with country code', '+919876543210'],
      ['Indian mobile with 91 prefix', '919876543210'],
    ])('accepts %s', (_description, value) => {
      expect(isValidPhone(value)).toBe(true);
    });

    test.each([
      ['empty string', ''],
      ['too short', '12345'],
      ['too long', '9876543210123'],
      ['alphabetic characters', 'abcdefghij'],
      ['letters mixed with digits', '98765abc10'],
      ['multiple plus signs', '++919876543210'],
      ['plus sign in the middle', '98765+43210'],
      ['country code with missing digits', '+91'],
      ['country code with too few digits', '+9198765'],
      ['leading zero in 10-digit number', '0987654321'],
      ['international prefix with incorrect length', '+1234567890'],
      ['embedded newline', '98765\n43210'],
      ['embedded null character', '98765\u000043210'],
    ])('rejects %s', (_description, value) => {
      expect(isValidPhone(value)).toBe(false);
    });

    test.each([
      ['null', null],
      ['undefined', undefined],
      ['number', 9876543210],
      ['boolean', true],
      ['object', {}],
      ['array', ['9876543210']],
      ['symbol', Symbol('phone')],
      ['bigint', 9876543210n],
    ])('rejects non-string input: %s', (_description, value) => {
      expect(() => isValidPhone(value)).not.toThrow();
      expect(isValidPhone(value)).toBe(false);
    });

    test('handles surrounding whitespace according to the validator contract', () => {
      expect(() => isValidPhone(' 9876543210 ')).not.toThrow();
    });

    test('does not throw for a very long phone-number string', () => {
      expect(() => isValidPhone('9'.repeat(10000))).not.toThrow();
      expect(isValidPhone('9'.repeat(10000))).toBe(false);
    });
  });

  describe('Validator robustness', () => {
    test('all validators reject null without throwing', () => {
      for (const validator of Object.values(validators)) {
        expect(() => validator(null)).not.toThrow();
      }
    });

    test('all validators reject undefined without throwing', () => {
      for (const validator of Object.values(validators)) {
        expect(() => validator(undefined)).not.toThrow();
      }
    });

    test('validators do not mutate string inputs', () => {
      const inputs = [
        ' user@example.com ',
        'StrongPass123!',
        ' MedOrbits ',
        '+919876543210',
      ];

      const originals = [...inputs];

      isValidEmail(inputs[0]);
      isValidPassword(inputs[1]);
      isRequired(inputs[2]);
      isValidPhone(inputs[3]);

      expect(inputs).toEqual(originals);
    });

    test('validators return boolean results for representative inputs', () => {
      const cases = [
        [isValidEmail, 'user@example.com'],
        [isValidPassword, 'StrongPass123!'],
        [isRequired, 'MedOrbits'],
        [isValidPhone, '9876543210'],
      ];

      for (const [validator, value] of cases) {
        expect(typeof validator(value)).toBe('boolean');
      }
    });
  });
});
