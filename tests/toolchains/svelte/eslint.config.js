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
      // The shape of design §5.3: `<script lang="ts">`.
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
    },
  },
];
