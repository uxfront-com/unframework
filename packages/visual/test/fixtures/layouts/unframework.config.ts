// A project whose examples set each kind of layout (ADR-0114): a flex layout with every word, the
// default, `none` and a malformed value, on the targets whose mounts differ most: Angular's host,
// Qwik's fresh container and Astro's server render.
export default {
  targets: ["vue", "angular", "qwik", "astro"],
  // Angular's and Vue's compiler stacks need TypeScript 6, which the workspace keeps in the
  // toolchains (AGENTS.md).
  package: {
    resolveFrom: {
      angular: "../../../../../tests/toolchains/angular",
      vue: "../../../../../tests/toolchains/vue",
    },
  },
};
