
/**
 * MedOrbits -- Unit Tests for Validators
 * File: tests/unit/validators.test.js
 *
 * Run: npm test -- --runInBand
 */

const {
  isValidEmail,
  isValidPassword,
  isRequired,
  isValidPhone,
} = require("../../src/validators");

describe("MedOrbits Validators", () => {
  describe("isValidEmail", () => {
    test("accepts a valid email address", () => {
      expect(isValidEmail("user@example.com")).toBe(true);
    });

    test("rejects an email without an @ symbol", () => {
      expect(isValidEmail("userexample.com")).toBe(false);
    });

    test("rejects an email without a domain", () => {
      expect(isValidEmail("user@")).toBe(false);
    });

    test("rejects empty input", () => {
      expect(isValidEmail("")).toBe(false);
    });

    test("rejects non-string input", () => {
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
      expect(isValidEmail(123)).toBe(false);
    });

    test("trims surrounding whitespace", () => {
      expect(isValidEmail(" user@example.com ")).toBe(true);
    });
  });

  describe("isValidPassword", () => {
    test("accepts a password meeting the minimum policy", () => {
      expect(isValidPassword("StrongPass123!")).toBe(true);
    });

    test("rejects a short password", () => {
      expect(isValidPassword("Ab1!")).toBe(false);
    });

    test("rejects empty input", () => {
      expect(isValidPassword("")).toBe(false);
    });

    test("rejects non-string input", () => {
      expect(isValidPassword(null)).toBe(false);
      expect(isValidPassword(123456)).toBe(false);
    });
  });

  describe("isRequired", () => {
    test("accepts a non-empty string", () => {
      expect(isRequired("MedOrbits")).toBe(true);
    });

    test("rejects an empty string", () => {
      expect(isRequired("")).toBe(false);
    });

    test("rejects whitespace-only input", () => {
      expect(isRequired("   ")).toBe(false);
    });

    test("rejects null and undefined", () => {
      expect(isRequired(null)).toBe(false);
      expect(isRequired(undefined)).toBe(false);
    });
  });

  describe("isValidPhone", () => {
    test("accepts a valid Indian mobile number", () => {
      expect(isValidPhone("9876543210")).toBe(true);
    });

    test("accepts an Indian number with country code", () => {
      expect(isValidPhone("+919876543210")).toBe(true);
    });

    test("rejects a number that is too short", () => {
      expect(isValidPhone("12345")).toBe(false);
    });

    test("rejects alphabetic input", () => {
      expect(isValidPhone("abcdefghij")).toBe(false);
    });

    test("rejects empty and non-string input", () => {
      expect(isValidPhone("")).toBe(false);
      expect(isValidPhone(null)).toBe(false);
    });
  });
});
