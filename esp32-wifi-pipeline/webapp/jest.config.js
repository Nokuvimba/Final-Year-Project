/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "./jest-custom-environment.js",
  testMatch: ["**/__tests__/**/*.test.ts"],
  setupFiles: ["./jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  globals: {
    "ts-jest": {
      tsconfig: {
        module: "commonjs",
        moduleResolution: "node",
      },
    },
  },
};

module.exports = config;
