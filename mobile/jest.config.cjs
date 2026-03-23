/** @type {import("ts-jest").JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  modulePathIgnorePatterns: ["<rootDir>/node_modules/"],
  watchPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.expo/"],
  // Single worker avoids long hangs / no-output issues on some Windows setups with tiny suites
  maxWorkers: process.env.CI ? "50%" : 1,
  moduleNameMapper: {
    "^react-native$": "<rootDir>/jest/react-native-mock.js",
  },
};
