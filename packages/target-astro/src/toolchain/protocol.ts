// What the browser and Node halves of the Astro toolchain exchange. Astro has no client runtime,
// so in a browser project a compiled component is only a reference: the mount adapter sends it
// to the `ufAstroRender` browser command, which renders it on the server. Nothing here may
// import Node or DOM APIs: both halves load this module.
import type { CapturedConsoleMessage } from "@unframework/codegen";
import type { experimental_AstroContainer as AstroContainer } from "astro/container";

/** The virtual id the unplugin gives an Astro output (`/abs/X.uf.tsx.astro`), with any query. */
export const ASTRO_VIRTUAL_ID: RegExp = /\.uf\.tsx\.astro(?:\?.*)?$/;

/** What `import X from "./X.uf.tsx"` yields in a browser project: a serialisable reference. */
export interface AstroComponentRef {
  __ufTarget: "astro";
  /** The virtual id, without a query: `/abs/X.uf.tsx.astro`. */
  id: string;
  /** The component's name, from the file name. */
  name: string;
}

/** The payload of the `ufAstroRender` browser command. */
export interface AstroRenderRequest {
  id: string;
  props: Record<string, unknown>;
}

/** What `ufAstroRender` returns: the server HTML and what the render logged. */
export interface AstroRenderResult {
  /** The component's HTML, preceded by its own `<style>` elements. */
  html: string;
  /** `console.warn` and `console.error` calls made while rendering (layer L13). */
  console: CapturedConsoleMessage[];
}

/** A compiled Astro component, as the Container API renders it. */
export type AstroComponentFactory = Parameters<AstroContainer["renderToString"]>[0];

/** Whether a module's default export is a compiled Astro component. */
export function isAstroComponentFactory(value: unknown): value is AstroComponentFactory {
  return (
    typeof value === "function" &&
    "isAstroComponentFactory" in value &&
    value.isAstroComponentFactory === true
  );
}

/** Splits `/abs/X.uf.tsx.astro?container` into the path and the query (with its `?`). */
export function splitQuery(id: string): [path: string, query: string] {
  const index = id.indexOf("?");
  return index === -1 ? [id, ""] : [id.slice(0, index), id.slice(index)];
}

/** Builds the reference a browser project's module exports for a virtual id. */
export function astroComponentRef(id: string): AstroComponentRef {
  const [path] = splitQuery(id);
  const file = path.slice(path.lastIndexOf("/") + 1);
  return { __ufTarget: "astro", id: path, name: file.slice(0, -".uf.tsx.astro".length) };
}

/** Whether a value is what a browser project's `.uf.tsx` import yields. */
export function isAstroComponentRef(value: unknown): value is AstroComponentRef {
  if (typeof value !== "object" || value === null) return false;
  const ref = value as Partial<AstroComponentRef>;
  return (
    ref.__ufTarget === "astro" &&
    typeof ref.id === "string" &&
    ASTRO_VIRTUAL_ID.test(ref.id) &&
    typeof ref.name === "string"
  );
}

/**
 * Props travel to the server as JSON, which would silently drop or change a function, a
 * symbol, `NaN` or a class instance. Rejects them instead, naming the prop.
 */
export function assertSerialisableProps(props: Readonly<Record<string, unknown>>): void {
  for (const [key, value] of Object.entries(props)) assertJsonValue(value, key);
}

function assertJsonValue(value: unknown, path: string): void {
  if (value === null || value === undefined) return;
  switch (typeof value) {
    case "string":
    case "boolean":
      return;
    case "number":
      if (Number.isFinite(value)) return;
      break;
    case "object": {
      if (Array.isArray(value)) {
        value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`));
        return;
      }
      const prototype: unknown = Object.getPrototypeOf(value);
      if (prototype === Object.prototype || prototype === null) {
        for (const [key, item] of Object.entries(value)) assertJsonValue(item, `${path}.${key}`);
        return;
      }
      break;
    }
  }
  throw new TypeError(
    `Astro renders on the server, so props must be JSON values; \`${path}\` is ${describe(value)}.`,
  );
}

function describe(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && value !== null) return `a ${value.constructor.name} instance`;
  return `a ${typeof value}`;
}
