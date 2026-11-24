// Solid 2 against the attributes the analyser lets a binding take (ADR-0037): how its
// compiler and runtime set each bindable boolean, and which bindings its JSX types reject although
// the authoring types and the analyser accept them (L4 would fail on Solid 2 alone).
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { typecheckWithTsgo } from "@unframework.dev/codegen/toolchain-node";
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
} from "@unframework.dev/ir";
import { afterAll, describe, expect, it } from "vitest";

// The analyser's own rules, by path (the package depends only on ir and codegen).
import { nameProblem } from "../../analyzer/src/attribute-names.ts";
import { boundValueProblem } from "../../analyzer/src/attributes.ts";
import { enumeratedValues } from "../../analyzer/src/enumerated.ts";
import { kinds } from "../../analyzer/src/types/kinds.ts";
import type { Kinds } from "../../analyzer/src/types/kinds.ts";
import { isUntyped, untypedAttribute } from "../src/attributes.ts";
import { loadCompiler } from "../src/toolchain/compile.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { compileForServer, packageDir, toolchainDir } from "./fixtures.ts";

const repo = fileURLToPath(new URL("../../..", import.meta.url));
const scratch = join(packageDir, ".uf-tmp", `attributes-${randomUUID()}`);
// The authoring types' checker needs TypeScript 7 installed above it: the Solid 2 toolchain's.
const authoringDir = join(toolchainDir, ".uf-tmp", `authoring-${randomUUID()}`);
mkdirSync(scratch, { recursive: true });
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
  rmSync(authoringDir, { recursive: true, force: true });
});

describe("solid2 bindable boolean attributes", () => {
  // Solid 2's compiler knows no boolean attribute: it passes every bound value to the runtime as
  // it is, which writes `true` as presence and `false` as absence, for every attribute alike. The
  // output writes every bindable boolean the analyser accepts as HTML does; this fails when either
  // list changes, or when Solid stops writing a boolean as presence.
  it("are presence to Solid 2, in the DOM and on the server", async () => {
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
    const source = `export default function Booleans(props: { on: boolean }) {\n  return (\n    <div>\n${pairs
      .map(({ tag, name }) => `      <${tag} ${name}={props.on} />`)
      .join("\n")}\n    </div>\n  );\n}\n`;
    const filename = join(scratch, "Booleans.tsx");
    const compiler = await loadCompiler({ toolchainDir, root: packageDir });
    const dom = compiler.transform(source, { filename, generate: "dom", hydratable: false }).code;
    for (const { tag, name } of pairs) {
      // The value as it is, which the runtime's `setAttribute` writes as presence.
      expect(dom, `<${tag} ${name}>`).toMatch(
        new RegExp(`setAttribute\\(_el\\$\\d+, "${name}", \\w+\\)`),
      );
    }
    const path = join(scratch, `Booleans-${randomUUID()}.js`);
    writeFileSync(path, await compileForServer(source, filename));
    const { default: Booleans } = (await import(path)) as { default: unknown };
    const on = await renderToString(Booleans, { props: { on: true } });
    const off = await renderToString(Booleans, { props: { on: false } });
    for (const { tag, name } of pairs) {
      expect(on, `<${tag} ${name}>`).toMatch(new RegExp(`<${tag}[^>]* ${name}[ >]`));
      expect(off, `<${tag} ${name}>`).not.toMatch(new RegExp(`<${tag}[^>]* ${name}[ >=]`));
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
    if (["class", "style"].includes(name)) {
      return;
    }
    if (namespace === "html" && isStateAttribute(tag, name, undefined)) {
      return;
    }
    if (nameProblem(tag, namespace, name, name)) {
      return;
    }
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
    for (const name of names) {
      add(tag, "html", name);
    }
  }
  for (const tag of [...SVG_ELEMENTS].filter(
    (element) => !SVG_UNRENDERABLE_ELEMENTS.has(element),
  )) {
    const names = new Set([
      ...SVG_GLOBAL_ATTRIBUTES,
      ...SVG_PRESENTATION_ATTRIBUTES,
      ...(SVG_ELEMENT_ATTRIBUTES.get(tag) ?? []),
    ]);
    for (const name of names) {
      add(tag, "svg", name);
    }
  }
  return found;
}

/** An element binding `name` to `value`: as an attribute, or as the output spreads it. */
function binding(name: string, value: string, form: "spread" | "untyped" | undefined) {
  const key = /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
  if (!form) {
    return `${name}={${value}}`;
  }
  const object = `{ ${key}: ${value} }`;
  return form === "spread" ? `{...${object}}` : `{...(${object} as Record<string, unknown>)}`;
}

/**
 * A binding as the output writes it on an element that takes it: an enumerated attribute's value that
 * may not be a string goes through the `enumeratedValue` helper (src/jsx.ts), which writes a boolean as
 * `"true"` or `"false"`, as Solid 2's types ask.
 */
function outputBinding(name: string, value: string): string {
  const enumerated =
    name.startsWith("aria-") || ["contenteditable", "draggable", "spellcheck"].includes(name);
  return enumerated && value !== "v.string" && !value.startsWith("(v.string as")
    ? `${name}={enumeratedValue(${value})}`
    : `${name}={${value}}`;
}

/** The `enumeratedValue` helper's signature, as the output declares it. */
const ARIA_VALUE = "declare function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T;";

/** A file of one element per line, from line 4, with `tail` after them. */
function sweepSource(lines: readonly string[], tail: readonly string[] = []): string {
  return [
    "declare const v: { string: string; number: number; boolean: boolean };",
    "export const all = (",
    "  <>",
    ...lines.map((line) => `    ${line}`),
    "  </>",
    ");",
    ...tail,
    "",
  ].join("\n");
}

describe("solid2 JSX types against every binding the analyser accepts (L4)", () => {
  // A binding the authoring types (`@uxfront/unframework`'s, vendored from Vue) and the analyser accept
  // is valid source, which the Solid output must type-check too. Where Solid's types lack the
  // attribute on that element (`fill` on <linearGradient>, `href` on <mpath>) or forbid it
  // (`tabindex` on <dialog>), the output spreads it (src/attributes.ts), alone on its element or
  // beside children. Each element of that table must be one Solid's types reject as written.
  it("accepts every one as the output writes it, and spreads only what they reject", async () => {
    const found = bindings();
    const solidFile = join(scratch, "Sweep.tsx");
    // Three lines per binding: as written, as the output writes it alone on its element, and
    // as it writes it beside children, an enumerated value through `enumeratedValue`.
    writeFileSync(
      solidFile,
      sweepSource(
        found.flatMap(([tag, name, value]) => {
          const alone = untypedAttribute(tag, name, false);
          const beside = untypedAttribute(tag, name, true);
          return [
            `<${tag} ${binding(name, value, undefined)} />`,
            `<${tag} ${alone ? binding(name, value, alone) : outputBinding(name, value)} />`,
            `<${tag} ${beside ? binding(name, value, beside) : outputBinding(name, value)}>{null}</${tag}>`,
          ];
        }),
        [ARIA_VALUE],
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
          jsxImportSource: "@uxfront/unframework",
          paths: {
            "@uxfront/unframework/jsx-runtime": [runtime],
            "@uxfront/unframework/jsx-dev-runtime": [runtime],
          },
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
      if (byAuthoring.has(index)) {
        return;
      }
      const [written, alone, beside] = [0, 1, 2].map((line) => bySolid.has(index * 3 + line));
      if (alone || beside) {
        rejectedAsWritten.push(`<${tag} ${name}={${value}}>`);
      }
      if (isUntyped(tag, name) && !written) {
        unneeded.push(`<${tag} ${name}={${value}}>`);
      }
    });
    expect(found.length).toBeGreaterThan(5000);
    expect(rejectedAsWritten).toEqual([]);
    expect(unneeded).toEqual([]);
  }, 120_000);
});
