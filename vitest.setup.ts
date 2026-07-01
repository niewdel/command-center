// Global vitest setup. Only affects test files opting into a DOM
// environment (jsdom, via the `// @vitest-environment jsdom` docblock);
// importing jest-dom's matchers is a no-op for plain node-environment
// unit tests.
import "@testing-library/jest-dom/vitest";
