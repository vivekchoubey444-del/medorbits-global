  
const fs = require("fs");
const path = require("path");

describe("MedOrbits CODEOWNERS", () => {
  const filePath = path.join(
    __dirname,
    "..",
    ".github",
    "CODEOWNERS"
  );

  let content;

  beforeAll(() => {
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, "utf8");
    }
  });

  test("CODEOWNERS file exists", () => {
    expect(fs.existsSync(filePath)).toBe(true);
  });

  test("contains the correct default owner", () => {
    expect(content).toMatch(
      /^\*\s+@vivekchoubey444-del\s*$/m
    );
  });

  test("assigns ownership to the src directory", () => {
    expect(content).toMatch(
      /^\/src\/\s+@vivekchoubey444-del\s*$/m
    );
  });

  test("assigns ownership to GitHub workflows", () => {
    expect(content).toMatch(
      /^\/\.github\/\s+@vivekchoubey444-del\s*$/m
    );
  });

  test("assigns ownership to package.json", () => {
    expect(content).toMatch(
      /^\/package\.json\s+@vivekchoubey444-del\s*$/m
    );
  });

  test("assigns ownership to security-sensitive components", () => {
    const requiredRules = [
      "/src/auth/",
      "/src/middleware/",
      "/src/validators/",
      "/src/controllers/",
      "/src/services/",
      "/src/repositories/"
    ];

    for (const rule of requiredRules) {
      expect(content).toMatch(
        new RegExp(
          "^" +
          rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
          "\\s+@vivekchoubey444-del\\s*$",
          "m"
        )
      );
    }
  });
});
