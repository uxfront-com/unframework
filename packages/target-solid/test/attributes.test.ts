// Solid against the attributes the analyser lets a binding take (ADR-0037): how its
// compiler sets each bindable boolean, and which bindings its JSX types reject although the
// authoring types and the analyser accept them (L4 would fail on Solid alone).
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { transformSync } from "@babel/core";
import { typecheckWithTsgo } from "@unframework/codegen/toolchain-node";
import {
  ARIA_ATTRIBUTES,
  BINDABLE_BOOLEAN_ATTRIBUTES,
  ELEMENT_ATTRIBUTES,
  GLOBAL_ATTRIBUTES,
  HTML_ELEMENTS,
  isHtmlAttribute,
  isStateAttribute,
  OBSOLETE_ELEMENTS,
  SVG_ELEMENT_ATTRIBUTES,
  SVG_ELEMENTS,
  SVG_GLOBAL_ATTRIBUTES,
  SVG_PRESENTATION_ATTRIBUTES,
  SVG_UNRENDERABLE_ELEMENTS,
  UNPORTABLE_ELEMENTS,
  UNRENDERABLE_ELEMENTS,
} from "@unframework/ir";
import { afterAll, describe, expect, it } from "vitest";

// The analyser's own rules, by path (the package depends only on ir and codegen).
import { nameProblem } from "../../analyzer/src/attribute-names.ts";
import { boundValueProblem } from "../../analyzer/src/attributes.ts";
import { enumeratedValues } from "../../analyzer/src/enumerated.ts";
import { kinds } from "../../analyzer/src/types/kinds.ts";
import type { Kinds } from "../../analyzer/src/types/kinds.ts";
import { isUntyped, untypedAttribute } from "../src/attributes.ts";
import { packageDir, toolchainDir } from "./fixtures.ts";

const require = createRequire(import.meta.url);
const repo = fileURLToPath(new URL("../../..", import.meta.url));
const scratch = join(packageDir, ".uf-tmp", `attributes-${randomUUID()}`);
// The authoring types' checker needs TypeScript 7 installed above it: the Solid toolchain's.
const authoringDir = join(toolchainDir, ".uf-tmp", `authoring-${randomUUID()}`);
mkdirSync(scratch, { recursive: true });
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
  rmSync(authoringDir, { recursive: true, force: true });
});

/** A source through babel-preset-solid, for the DOM or the server. */
function compiled(source: string, generate: "dom" | "ssr"): string {
  return transformSync(source, {
    filename: join(scratch, "Booleans.tsx"),
    babelrc: false,
    configFile: false,
    presets: [
      [require.resolve("babel-preset-solid"), { generate, hydratable: generate === "ssr" }],
      [require.resolve("@babel/preset-typescript"), { isTSX: true, allExtensions: true }],
    ],
  })!.code!;
}

describe("solid bindable boolean attributes", () => {
  // A bindable boolean Solid's compiler does not know as one would need `bool:name={x}`, or it
  // would set `name="false"`. It knows every one the analyser accepts, so the output writes them
  // as HTML does; this fails when either list changes.
  it("are booleans to Solid's compiler, as a property or presence, in the DOM and on the server", () => {
    const pairs = [...BINDABLE_BOOLEAN_ATTRIBUTES].flatMap((name) => {
      const tag = [...HTML_ELEMENTS].find(
        (candidate) =>
          isHtmlAttribute(candidate, name) &&
          !isStateAttribute(candidate, name, undefined) &&
          !nameProblem(candidate, "html", name, name) &&
          !boundValueProblem(candidate, "html", name, kinds("boolean")),
      );
      return tag ? [{ tag, name }] : [];
    });
    // Form state and `autofocus` are never bound, an iframe's `allowfullscreen` is unbindable,
    // and `ismap` is an attribute React's types lack, which the analyser rejects.
    expect(
      [...BINDABLE_BOOLEAN_ATTRIBUTES].filter((name) => !pairs.some((pair) => pair.name === name)),
    ).toEqual(["allowfullscreen", "autofocus", "checked", "ismap", "muted", "selected"]);
    const source = `export function Booleans(props: { on: boolean }) {\n  return (\n    <div>\n${pairs
      .map(({ tag, name }) => `      <${tag} ${name}={props.on} />`)
      .join("\n")}\n    </div>\n  );\n}\n`;
    const dom = compiled(source, "dom");
    const ssr = compiled(source, "ssr");
    for (const { tag, name } of pairs) {
      expect(dom, `<${tag} ${name}>`).not.toMatch(new RegExp(`setAttribute\\([^,]+, "${name}"`));
      expect(ssr, `<${tag} ${name}>`).toContain(`ssrAttribute("${name}", props.on, true)`);
    }
  });
});

/** The primitive kinds a sweep binds: `undefined` adds nothing to `string`, and the authoring
 * types take `null` almost nowhere. */
const KINDS = ["string", "number", "boolean"] as const;

/** A binding the sweep checks: the element, the attribute, and its value as code. */
type SweptBinding = [tag: string, name: string, value: string];

/** An HTML element the analyser rejects, so no binding reaches Solid on it. */
function rejected(tag: string): boolean {
  return (
    UNRENDERABLE_ELEMENTS.has(tag) || UNPORTABLE_ELEMENTS.has(tag) || OBSOLETE_ELEMENTS.has(tag)
  );
}

/**
 * Every binding of a primitive kind the analyser accepts, on every element it accepts, and of
 * the union of its tokens for an enumerated attribute (which takes only those, UF3018).
 */
function bindings(): SweptBinding[] {
  const found: SweptBinding[] = [];
  const add = (tag: string, namespace: "html" | "svg", name: string) => {
    // Attributes the analyser takes only statically, or by a kind of their own (class, style).
    if (["class", "style"].includes(name)) return;
    if (namespace === "html" && isStateAttribute(tag, name, undefined)) return;
    if (nameProblem(tag, namespace, name, name)) return;
    for (const kind of KINDS) {
      if (!boundValueProblem(tag, namespace, name, kinds(kind))) {
        found.push([tag, name, `v.${kind}`]);
      }
    }
    const tokens = enumeratedValues(tag, namespace, name)?.tokens ?? [];
    const union: Kinds = { primitives: new Set(["string"]), strings: new Set(tokens) };
    if (tokens.length && !boundValueProblem(tag, namespace, name, union)) {
      found.push([
        tag,
        name,
        `(v.string as ${tokens.map((token) => JSON.stringify(token)).join(" | ")})`,
      ]);
    }
  };
  for (const tag of [...HTML_ELEMENTS].filter((element) => !rejected(element)).toSorted()) {
    const names = new Set([
      ...GLOBAL_ATTRIBUTES,
      ...(ELEMENT_ATTRIBUTES.get(tag) ?? []),
      ...ARIA_ATTRIBUTES,
    ]);
    for (const name of names) add(tag, "html", name);
  }
  for (const tag of [...SVG_ELEMENTS].filter(
    (element) => !SVG_UNRENDERABLE_ELEMENTS.has(element),
  )) {
    const names = new Set([
      ...SVG_GLOBAL_ATTRIBUTES,
      ...SVG_PRESENTATION_ATTRIBUTES,
      ...(SVG_ELEMENT_ATTRIBUTES.get(tag) ?? []),
    ]);
    for (const name of names) add(tag, "svg", name);
  }
  return found;
}

/** An element binding `name` to `value`: as an attribute, or as the output spreads it. */
function binding(name: string, value: string, form: "spread" | "untyped" | undefined) {
  const key = /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
  if (!form) return `${name}={${value}}`;
  const object = `{ ${key}: ${value} }`;
  return form === "spread" ? `{...${object}}` : `{...(${object} as Record<string, unknown>)}`;
}

/** A file of one element per line, from line 4. */
function sweepSource(lines: readonly string[]): string {
  return [
    "declare const v: { string: string; number: number; boolean: boolean };",
    "export const all = (",
    "  <>",
    ...lines.map((line) => `    ${line}`),
    "  </>",
    ");",
    "",
  ].join("\n");
}

describe("solid JSX types against every binding the analyser accepts (L4)", () => {
  // A binding the authoring types (`unframework`'s, vendored from Vue) and the analyser accept
  // is valid source, which the Solid output must type-check too. Where Solid's types lack the
  // attribute on that element (`fill` on <linearGradient>, `href` on <mpath>) or forbid it
  // (`tabindex` on <dialog>), the output spreads it (src/attributes.ts), alone on its element or
  // beside children. Each element of that table must be one Solid's types reject as written.
  it("accepts every one as the output writes it, and spreads only what they reject", async () => {
    const found = bindings();
    const solidFile = join(scratch, "Sweep.tsx");
    // Three lines per binding: as written, as the output writes it alone on its element, and
    // as it writes it beside children.
    writeFileSync(
      solidFile,
      sweepSource(
        found.flatMap(([tag, name, value]) => [
          `<${tag} ${binding(name, value, undefined)} />`,
          `<${tag} ${binding(name, value, untypedAttribute(tag, name, false))} />`,
          `<${tag} ${binding(name, value, untypedAttribute(tag, name, true))}>{null}</${tag}>`,
        ]),
      ),
    );
    mkdirSync(authoringDir, { recursive: true });
    const runtime = join(repo, "packages/unframework/src/jsx-runtime.ts");
    writeFileSync(
      join(authoringDir, "tsconfig.json"),
      JSON.stringify({
        extends: join(repo, "tsconfig.base.json"),
        compilerOptions: {
          jsx: "preserve",
          jsxImportSource: "unframework",
          paths: { "unframework/jsx-runtime": [runtime], "unframework/jsx-dev-runtime": [runtime] },
          declaration: false,
          isolatedDeclarations: false,
          noEmit: true,
        },
      }),
    );
    const authoringFile = join(scratch, "Sweep.uf.tsx");
    writeFileSync(
      authoringFile,
      sweepSource(found.map(([tag, name, value]) => `<${tag} ${name}={${value}} />`)),
    );
    const [solid, authoring] = await Promise.all([
      typecheckWithTsgo([solidFile], { toolchainDir, root: packageDir }),
      typecheckWithTsgo([authoringFile], { toolchainDir: authoringDir, root: packageDir }),
    ]);
    expect([...authoring.keys()]).toEqual([authoringFile]);
    expect([...solid.keys()]).toEqual([solidFile]);
    const byAuthoring = new Set(authoring.get(authoringFile)!.map((message) => message.line! - 4));
    const bySolid = new Set(solid.get(solidFile)!.map((message) => message.line! - 4));
    const rejectedAsWritten: string[] = [];
    const unneeded: string[] = [];
    found.forEach(([tag, name, value], index) => {
      if (byAuthoring.has(index)) return;
      const [written, alone, beside] = [0, 1, 2].map((line) => bySolid.has(index * 3 + line));
      if (alone || beside) rejectedAsWritten.push(`<${tag} ${name}={${value}}>`);
      if (isUntyped(tag, name) && !written) unneeded.push(`<${tag} ${name}={${value}}>`);
    });
    expect(found.length).toBeGreaterThan(5000);
    expect(rejectedAsWritten).toEqual([]);
    expect(unneeded).toEqual([]);
  }, 120_000);
});
