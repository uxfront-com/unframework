import templateRules from "eslint-plugin-ember/configs/template-lint-migration";
// L5 (ADR-0042): ESLint with eslint-plugin-ember over every Ember output file, its class and its
// template, which oxlint does not parse: the plugin's recommended rules for `.gts` and the
// template rules that ember-template-lint's recommended set had. L5 judges the emitter's idiom,
// not the author's code (ADR-0042): each rule that is off says why.
import ember from "eslint-plugin-ember/recommended";
import tseslint from "typescript-eslint";

export default [
  ...templateRules,
  ember.configs.base,
  ember.configs.gts,
  {
    files: ["**/*.gts"],
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      // The baseline's unused-variable rule, with the options oxlint's takes by default (a
      // variable or a parameter whose name starts with `_` is ignored). ember-eslint-parser
      // counts the template's reads of the module's names.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
      // Judge the author's markup, which every target renders as written: a `style` attribute
      // (ADR-0038), a positive `tabindex`, a control's labels, a `<button>` without a `type`.
      "ember/template-no-inline-styles": "off",
      "ember/template-no-positive-tabindex": "off",
      "ember/template-require-input-label": "off",
      "ember/template-require-button-type": "off",
      // Judge the author's listeners, which every target adds as written: one on a `<div>`, one
      // for `pointerdown`, a click listener on a submit button.
      "ember/template-no-action-on-submit-button": "off",
      // eslint-plugin-ember 13.11 lowercases a tag before it tests it, so it reads a component
      // named like an interactive element (`<Button>`) as that element
      // (ember-cli/eslint-plugin-ember#2900).
      "ember/template-no-nested-interactive": "off",
      "ember/template-no-invalid-interactive": "off",
      "ember/template-no-pointer-down-event-binding": "off",
      // A state the author seeds from a prop is a copy of its first value, as Vue's `ref(props.x)`
      // is: the source asks for it.
      "ember/no-tracked-properties-from-args": "off",
      // Judges text that holds `}}`, which Glimmer renders as written; the `{{` of the author's
      // text is escaped (`\{{`), so no mustache opens there.
      "ember/template-no-unbalanced-curlies": "off",
    },
  },
];
