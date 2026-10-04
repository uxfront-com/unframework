// L5 (ADR-0042): ESLint with angular-eslint over every Angular output file and its inline
// template, beside the oxlint baseline (output.oxlintrc.json), which lints the TypeScript. L5
// judges the emitter's idiom, not the author's code (design §6.1): each rule that is off says
// why.
// angular-eslint's template accessibility rules are not named: L11 owns accessibility.
import angular from "@angular-eslint/eslint-plugin";
import angularTemplate from "@angular-eslint/eslint-plugin-template";
import * as templateParser from "@angular-eslint/template-parser";
import tseslint from "typescript-eslint";

export default [
  {
    files: ["**/*.ts"],
    languageOptions: { parser: tseslint.parser },
    plugins: { "@angular-eslint": angular },
    // Lints each inline template as a file of its own, with the block below.
    processor: angularTemplate.processors["extract-inline-html"],
    rules: {
      // angular-eslint's recommended rules.
      "@angular-eslint/contextual-lifecycle": "error",
      "@angular-eslint/no-empty-lifecycle-method": "error",
      "@angular-eslint/no-input-rename": "error",
      "@angular-eslint/no-inputs-metadata-property": "error",
      "@angular-eslint/no-output-native": "error",
      "@angular-eslint/no-output-on-prefix": "error",
      "@angular-eslint/no-output-rename": "error",
      "@angular-eslint/no-outputs-metadata-property": "error",
      "@angular-eslint/prefer-inject": "error",
      "@angular-eslint/prefer-on-push-component-change-detection": "error",
      "@angular-eslint/prefer-standalone": "error",
      "@angular-eslint/use-pipe-transform-interface": "error",
      // The shapes of design §5.5: signal inputs, and an element selector with the `uf` prefix
      // (D6).
      "@angular-eslint/component-selector": [
        "error",
        { type: "element", prefix: "uf", style: "kebab-case" },
      ],
      "@angular-eslint/prefer-signals": "error",
    },
  },
  {
    files: ["**/*.html"],
    languageOptions: { parser: templateParser },
    plugins: { "@angular-eslint/template": angularTemplate },
    rules: {
      // angular-eslint's recommended template rules.
      "@angular-eslint/template/banana-in-box": "error",
      "@angular-eslint/template/no-negated-async": "error",
      "@angular-eslint/template/prefer-control-flow": "error",
      // `==` as the author wrote it: design §1.2 accepts it, and it renders alike everywhere.
      "@angular-eslint/template/eqeqeq": "off",
      // How the emitter writes a template: bindings rather than interpolated attributes, no
      // attribute twice (a static `class` or `style` beside its binding is Angular's styling
      // precedence, which design §5.5 relies on), and no empty control-flow block.
      "@angular-eslint/template/no-duplicate-attributes": [
        "error",
        { allowStylePrecedenceDuplicates: true },
      ],
      "@angular-eslint/template/no-empty-control-flow": "error",
      "@angular-eslint/template/no-interpolation-in-attributes": "error",
    },
  },
];
