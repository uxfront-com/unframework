// A module only a project's own Vite plugin serves (ADR-0104): `virtual:uf-fixture`, whose one
// function gives the class names of a greeting, as a styling engine's does (ADR-0064). No package
// resolves it, so a component that imports it renders only where the project's plugins reach.
import type { Plugin } from "vite";

const MODULE = "virtual:uf-fixture";

const CODE = `export function greeting(tone) {
  return tone === "warm" ? "uf-greeting uf-greeting--warm" : "uf-greeting";
}
`;

/** The plugin, with the module's id under Rollup's `\0` prefix, which no other plugin reads. */
export function ufFixturePlugin(): Plugin {
  return {
    name: "uf-fixture",
    enforce: "pre",
    resolveId: (id) => (id === MODULE ? `\0${MODULE}` : null),
    load: (id) => (id === `\0${MODULE}` ? CODE : null),
  };
}
