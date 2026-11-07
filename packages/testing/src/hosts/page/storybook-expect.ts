// Storybook's preview bundles an `@vitest/expect` of its own, with its state under a key of its own
// (`$$jest-matchers-object-storybook`), and it loads first. `@vitest/expect` sets up its globals only
// when `matchers-object` is free, so the copy this page host uses would find no
// `$$jest-matchers-object`, and its first `expect` would throw. This module runs ahead of that copy,
// and gives it the one global it can't have made. Storybook's copy keeps its own.
const MATCHERS_OBJECT = Symbol.for("matchers-object");
const JEST_MATCHERS_OBJECT = Symbol.for("$$jest-matchers-object");
const GLOBAL_EXPECT = Symbol.for("expect-global");

const page = globalThis as unknown as Record<symbol, unknown>;

if (Object.hasOwn(page, MATCHERS_OBJECT) && !Object.hasOwn(page, JEST_MATCHERS_OBJECT)) {
  const state = page[MATCHERS_OBJECT] as WeakMap<object, unknown>;
  const matchers = Object.create(null) as Record<string, unknown>;
  const customEqualityTesters: unknown[] = [];
  Object.defineProperty(page, JEST_MATCHERS_OBJECT, {
    configurable: true,
    get: () => ({
      state: state.get(page[GLOBAL_EXPECT] as object),
      matchers,
      customEqualityTesters,
    }),
  });
}
