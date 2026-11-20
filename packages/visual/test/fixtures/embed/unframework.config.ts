// An embed's fixture (ADR-0116): a component whose colour follows Styleframe's theme selector,
// `[data-theme="dark"]`, and whose height a control changes, on one client target and the
// target that renders on the server. One example brings a project's global styles, which style
// `body`, `label` and `select`, and the other brings none, so a test compares the embed's panel
// under both.
export default {
  targets: ["vue", "astro"],
  // Vue's compiler stack needs TypeScript 6, which the workspace keeps in its toolchain.
  package: { resolveFrom: { vue: "../../../../../tests/toolchains/vue" } },
};
