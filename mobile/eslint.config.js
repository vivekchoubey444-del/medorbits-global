const tsParserAvailable = true;
export default [
  {
    ignores: ["node_modules/**", ".expo/**", "dist/**", "coverage/**"]
  },
  {
    files: ["**/*.js", "**/*.ts", "**/*.tsx"],
    rules: {
      "no-debugger": "error",
      "no-constant-condition": "error"
    }
  }
];
