// L5 (ADR-0042): ESLint with eslint-plugin-svelte over every Svelte output file, beside the
// oxlint baseline (output.oxlintrc.json), which lints the script blocks. L5 judges the emitter's
// idiom, not the author's code (design §6.1): each rule that is off says why.
import svelte from "eslint-plugin-svelte";
import tseslint from "typescript-eslint";

export default [
  ...svelte.configs["flat/recommended"],
  {
    files: ["**/*.svelte"],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
    rules: {
      // ESLint's `noInlineConfig` does not reach the markup's `<!-- eslint-disable -->`
      // comments, which this rule implements: an output must not silence its linter.
      "svelte/comment-directive": "off",
      // The shape of design §5.3: `<script lang="ts">`.
      "svelte/block-lang": ["error", { script: "ts" }],
      // The printer writes whitespace that Svelte would trim or condense as a string-literal
      // mustache (`{" "}`), Svelte's own spelling for it; whitespace is the printer's (ADR-0026).
      "svelte/no-useless-mustaches": "off",
      // SvelteKit's router: the outputs are plain components, and a link's href is the author's.
      "svelte/no-navigation-without-resolve": "off",
      // Judges the author's props type: a declared prop the component never reads is the author's.
      "svelte/no-unused-props": "off",
      // L3 runs Svelte's compiler and owns its warnings, as ADR-0028 did for L4.
      "svelte/valid-compile": "off",
    },
  },
];
