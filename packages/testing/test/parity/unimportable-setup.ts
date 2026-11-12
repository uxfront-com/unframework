// A setup file no page can import, for test/setup-import.test.ts (ADR-0092): every spec file of
// a project that sets it up stops before its first test, and Vitest wraps this error in its own.
throw new SyntaxError("[fixture] this setup file cannot be imported");
