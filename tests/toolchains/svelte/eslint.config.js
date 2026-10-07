// L5 (ADR-0042): ESLint with eslint-plugin-svelte over every Svelte output file, beside the
// oxlint baseline (output.oxlintrc.json), which lints the script blocks. L5 judges the emitter's
// idiom, not the author's code (ADR-0042): each rule that is off says why.
import svelte from "eslint-plugin-svelte";
import tseslint from "typescript-eslint";

export default [
  ...svelte.configs["flat/recommended"],
  {
    files: ["**/*.svelte"],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      // The baseline's unused-variable rule, which oxlint does not run on a `.svelte` file: the
      // markup reads the script's bindings where oxlint cannot see them, and
      // svelte-eslint-parser counts those reads. typescript-eslint's, with the options oxlint's
      // takes by default (a variable or a parameter whose name starts with `_` is ignored). It
      // also reports a value only a type reads, which oxlint's does not: that value is dead too.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
      // ESLint's `noInlineConfig` does not reach the markup's `<!-- eslint-disable -->`
      // comments, which this rule implements: an output must not silence its linter.
      "svelte/comment-directive": "off",
      // The shape of plan §6: `<script lang="ts">`.
      "svelte/block-lang": ["error", { script: "ts" }],
      // The printer writes whitespace that Svelte would trim or condense as a string-literal
      // mustache (`{" "}`), Svelte's own spelling for it; whitespace is the printer's (ADR-0026).
      // So is a static value the dialect writes as a string literal (`title={"…"}`,
      // `style:font-family={"…"}`) where Svelte's server would render it unlike its client: one
      // holding `&`, `<` or `"`, which the server escapes twice in a `style:` directive, on an
      // `<option>` and on an element that carries one of the dialect's object spreads
      // (`{...{ autocorrect }}`), and a `style` or `style:` value holding whitespace the server
      // folds (packages/codegen/src/markup/svelte.ts).
      "svelte/no-useless-mustaches": "off",
      // SvelteKit's router: the outputs are plain components, and a link's href is the author's.
      "svelte/no-navigation-without-resolve": "off",
      // Judges the author's props type: a declared prop the component never reads is the author's.
      "svelte/no-unused-props": "off",
      // L3 runs Svelte's compiler and owns its warnings, as ADR-0028 did for L4.
      "svelte/valid-compile": "off",
      // Judges the author's local values: a handler that builds and fills a `new Map()`, a
      // `new Set()` or a `new Date()` of its own, which the client subset allows (a fresh local
      // value may be mutated, UF2004), would fail Svelte alone. The target makes no such value:
      // state is a rune, and replaced whole (ADR-0008; the M2 amendment of ADR-0042).
      "svelte/prefer-svelte-reactivity": "off",
      // Judges the author's choice of `watchEffect` over `computed`: an effect that only writes
      // one state is the author's code, which the target prints as an `$effect`. A writable
      // `$derived` would change what the server renders, since an effect runs in the browser
      // only and a derived value renders on the server too (ADR-0042, ADR-0048).
      "svelte/prefer-writable-derived": "off",
    },
  },
];
