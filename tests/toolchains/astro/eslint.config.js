// L5 (ADR-0042): ESLint with eslint-plugin-astro over every Astro output file, beside the oxlint
// baseline (output.oxlintrc.json), which lints the frontmatter. L5 judges the emitter's idiom,
// not the author's code (design §6.1). eslint-plugin-astro's own `recommended` set is mostly
// deprecations, so the rules that check how markup is written are named here. Not named:
// `valid-compile` (L3 runs Astro's compiler and owns its messages), `semi` and
// `sort-attributes` (the printer owns layout and keeps the author's order, ADR-0026) and
// `jsx-a11y/*` (L11 owns accessibility).
import { configs, processors } from "eslint-plugin-astro";
import tseslint from "typescript-eslint";

export default [
  ...configs["flat/recommended"],
  {
    files: ["**/*.astro"],
    // eslint-plugin-astro looks for a TypeScript parser from the process's working directory, and
    // parses the frontmatter as JavaScript when it finds none: name it, so the frontmatter is
    // TypeScript wherever ESLint runs.
    languageOptions: { parserOptions: { parser: tseslint.parser } },
    processor: processors["client-side-ts"],
    rules: {
      "astro/no-set-html-directive": "error",
      "astro/no-set-text-directive": "error",
      "astro/no-unsafe-inline-scripts": "error",
      "astro/no-unused-css-selector": "error",
      // The shape of design §5.7: `class:list` for every class binding.
      "astro/prefer-class-list-directive": "error",
      // Off: they judge the author's class expressions (`c ? "a" : "b"`, `` `btn btn-${size}` ``),
      // which every target copies as written.
      "astro/prefer-object-class-list": "off",
      "astro/prefer-split-class-list": "off",
    },
  },
];
