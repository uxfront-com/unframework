// The Babel config ember.nvp generates for an app, without the production-only debug macros.
import { buildMacros } from "@embroider/macros/babel";

const macros = buildMacros();

export default {
  presets: [["@babel/preset-typescript", { allExtensions: true, onlyRemoveTypeImports: true }]],
  plugins: [
    ["babel-plugin-ember-template-compilation", { transforms: [...macros.templateMacros] }],
    [
      "module:decorator-transforms",
      { runtime: { import: import.meta.resolve("decorator-transforms/runtime-esm") } },
    ],
    ...macros.babelMacros,
  ],
};
