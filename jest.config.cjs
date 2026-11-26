/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  moduleNameMapper: {
    ".*/database/prisma$": "<rootDir>/tests/databasePrismaStub.js",
  },
  testPathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/tests/integration_tests/",
  ],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { diagnostics: false }],
  },
};
