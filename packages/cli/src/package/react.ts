import type { Packager } from "./packager.ts";
import { buildWithTsdown } from "./tsdown.ts";

/** Plan §8.4: JS and `.d.ts`, through tsdown. The range is what the output needs: `useEffectEvent`. */
export const react: Packager = {
  peer: { name: "react", range: "^19.2.0" },
  needs: ["tsdown"],
  types: "@types/react",
  exports: { types: "./react/index.d.ts", default: "./react/index.js" },
  run: (input) =>
    buildWithTsdown(input, { jsx: "react-jsx", jsxImportSource: "react" }, [{ extension: ".js" }]),
};
