module.exports = {
  preset: "ts-jest",
  modulePathIgnorePatterns: ["<rootDir>/.aws-sam", "dist"],
  globals: {
    "ts-jest": {
      tsconfig: {
        lib: ["ES2019"],
        module: "commonjs",
        target: "ES2019",
      },
    },
  },
};
