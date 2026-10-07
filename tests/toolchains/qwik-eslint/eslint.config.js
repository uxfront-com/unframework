// L5 (ADR-0042, and its M2 amendment): eslint-plugin-qwik's type-aware rules over every Qwik
// output file. They read TypeScript's types, which oxlint gives no JS plugin, so they run in
// ESLint, through typescript-eslint, which loads TypeScript 6 and not TypeScript 7. The Qwik
// toolchain beside this host installs TypeScript 7 for tsgo (L4), and a package resolves one
// `typescript`, so the TypeScript 6 lint host is a package of its own (R8). Every other rule, the
// plugin's included, stays in oxlint (../qwik/output.oxlintrc.json).
// The types are L4's: the Qwik toolchain's `lint` gives the run its tsconfig
// (../qwik/tsconfig.json), and the run extends it with exactly the files it lints.
import { qwikEslint9Plugin as qwik } from "eslint-plugin-qwik";
import tseslint from "typescript-eslint";

export default [
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { parser: tseslint.parser },
    plugins: { qwik },
    rules: {
      // A `$` scope captures only what Qwik can serialise and never assigns a `let` it captures:
      // why a function client code calls is a `$()` QRL or at module scope, and a setup `let`
      // a signal. `any` stays allowed (the rule's default): a type the author wrote.
      "qwik/valid-lexical-scope": "error",
      // An async computed's `.value` is read first in a QRL, or after `await x.promise()`.
      "qwik/use-async-top": "error",
    },
  },
];
