// L5 (ADR-0042): ESLint with eslint-plugin-vue over every Vue output file, beside the oxlint
// baseline (output.oxlintrc.json), which lints the script blocks. L5 judges the emitter's idiom,
// not the author's code (design §6.1): each rule that is off says why.
import vue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";

export default [
  ...vue.configs["flat/recommended-error"],
  // Layout is the printer's: markup is never formatted (ADR-0026).
  vue.configs["no-layout-rules"],
  {
    files: ["**/*.vue"],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
    rules: {
      // ESLint's `noInlineConfig` does not reach the template's `<!-- eslint-disable -->`
      // comments, which this rule implements: an output must not silence its linter.
      "vue/comment-directive": "off",
      // The shapes of design §5.2: `<script setup lang="ts">` with a type-based `defineProps`.
      "vue/block-lang": ["error", { script: { lang: "ts" } }],
      "vue/component-api-style": ["error", ["script-setup"]],
      "vue/define-props-declaration": ["error", "type-based"],
      // A component's name is the author's.
      "vue/multi-word-component-names": "off",
      // A list parameter may reuse a name; UF3024 rejects the ones a rewrite would capture.
      "vue/no-template-shadow": "off",
    },
  },
];
