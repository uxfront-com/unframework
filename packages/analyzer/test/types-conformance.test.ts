// Bound values against the typed targets' element types (ADR-0037): Vue's, React's, Solid's,
// Qwik's, Svelte's and Astro's, each read under the name its target prints. A value the analyser
// accepts for an attribute of an element (any string, any boolean, an enumerated attribute's
// tokens) must be one every target's types accept, or the output fails L4 there; and the table of
// enumerated attributes lists only what some target restricts. Angular binds `[attr.x]`, which
// its compiler does not type. The check runs the `tsc` executable over generated probes, as the
// unframework package's type probes do: it never loads TypeScript's API.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  ARIA_ATTRIBUTES,
  undeclaredBy,
  UNPORTABLE_ELEMENTS,
  ELEMENT_ATTRIBUTES,
  GLOBAL_ATTRIBUTES,
  HTML_ELEMENTS,
  isHtmlAttribute,
  isSvgAttribute,
  SVG_ELEMENT_ATTRIBUTES,
  SVG_ELEMENTS,
  SVG_GLOBAL_ATTRIBUTES,
  UNRENDERABLE_ELEMENTS,
} from "@unframework/ir";
import type { Namespace } from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import { afterAll, describe, expect, it } from "vitest";

import { isTargetStringAttribute, nameProblem } from "../src/attribute-names.ts";
import { boundValueProblem } from "../src/attributes.ts";
import { enumeratedValues, staticTokens } from "../src/enumerated.ts";
import type { Enumerated } from "../src/enumerated.ts";
import { BOOLEAN, NUMBER, STRING, stringLiteral, union, UNKNOWN } from "../src/types/kinds.ts";
import type { Kinds } from "../src/types/kinds.ts";

const ROOT = new URL("../../../", import.meta.url);

/** A package's folder, as a workspace package resolves it. */
function packageFolder(from: string, name: string): string {
  const require = createRequire(new URL(`${from}/package.json`, ROOT));
  return dirname(require.resolve(`${name}/package.json`));
}

/** A package's type entry, from its manifest. */
function typesOf(folder: string): string {
  const manifest = JSON.parse(readFileSync(join(folder, "package.json"), "utf8")) as {
    types?: string;
    typings?: string;
  };
  return join(folder, manifest.types ?? manifest.typings ?? "index.d.ts");
}

/** A target's table of the names it prints, read from its source (targets sit above us). */
function nameTable(file: string, table: string): ReadonlyMap<string, string> {
  const source = readFileSync(new URL(file, ROOT), "utf8");
  const names = new Map<string, string>();
  for (const statement of parseModule(file, source).program.body) {
    if (statement.type !== "ExportNamedDeclaration") continue;
    const declaration = statement.declaration;
    if (declaration?.type !== "VariableDeclaration") continue;
    for (const declarator of declaration.declarations) {
      if (declarator.id.type !== "Identifier" || declarator.id.name !== table) continue;
      if (declarator.init?.type !== "ObjectExpression") continue;
      for (const property of declarator.init.properties) {
        if (property.type !== "Property" || property.value.type !== "Literal") continue;
        const key =
          property.key.type === "Identifier"
            ? property.key.name
            : property.key.type === "Literal"
              ? String(property.key.value)
              : undefined;
        if (key !== undefined) names.set(key, String(property.value.value));
      }
    }
  }
  if (!names.size) throw new Error(`${table} was not found in ${file}`);
  return names;
}

const REACT_NAMES = nameTable("packages/target-react/src/props.ts", "REACT_PROP_NAMES");
const QWIK_NAMES = nameTable("packages/target-qwik/src/attributes.ts", "QWIK_ATTRIBUTE_NAMES");

interface Library {
  readonly name: string;
  /** The type that maps a tag to its attributes. */
  readonly elements: string;
  readonly key: (namespace: Namespace, name: string) => string;
}

const asWritten = (_namespace: Namespace, name: string): string => name;

const LIBRARIES: readonly Library[] = [
  // The authoring types: what the source itself is checked against (Vue's, vendored).
  { name: "Authoring", elements: "AuthoringElements", key: asWritten },
  { name: "Vue", elements: "VueElements", key: asWritten },
  {
    name: "React",
    elements: "ReactJSX.IntrinsicElements",
    key: (_namespace, name) => REACT_NAMES.get(name) ?? name,
  },
  { name: "Solid", elements: "SolidJSX.IntrinsicElements", key: asWritten },
  {
    name: "Qwik",
    elements: "QwikJSX.IntrinsicElements",
    key: (namespace, name) => (namespace === "html" ? (QWIK_NAMES.get(name) ?? name) : name),
  },
  { name: "Svelte", elements: "SvelteHTMLElements", key: asWritten },
  { name: "Astro", elements: "astroHTML.JSX.DefinedIntrinsicElements", key: asWritten },
];

const AUTHORING = new URL("packages/unframework/src/jsx-runtime.ts", ROOT).pathname;

const HEADER = [
  `import type { UfIntrinsicElements as AuthoringElements } from ${JSON.stringify(AUTHORING)};`,
  'import type { NativeElements as VueElements } from "@vue/runtime-dom";',
  'import type { JSX as ReactJSX } from "react";',
  'import type { JSX as SolidJSX } from "solid-js";',
  'import type { JSX as QwikJSX } from "@qwik.dev/core";',
  'import type { SvelteHTMLElements } from "svelte/elements";',
  "// An attribute's type, or `__missing__` where the element or the attribute is not declared.",
  "type P<R, T extends string, K extends string> = T extends keyof R",
  '  ? K extends keyof R[T] ? NonNullable<R[T][K]> : "__missing__"',
  '  : "__missing__";',
  "// 1 where a value of type V is accepted (`any` accepts all), 0 where it is not, 2 where",
  "// nothing is declared.",
  'type A<V, T> = 0 extends 1 & T ? 1 : [T] extends ["__missing__"] ? 2 : [V] extends [T] ? 1 : 0;',
];

const VERDICT =
  /(?:^|[\\/])probe\.ts\((\d+),\d+\): error TS2322: Type '3' is not assignable to type '(\d)'\.$/;

interface Check {
  readonly value: string;
  readonly namespace: Namespace;
  readonly tag: string;
  readonly name: string;
  readonly library: Library;
}

const folder = mkdtempSync(join(tmpdir(), "uf-types-conformance-"));
afterAll(() => rmSync(folder, { recursive: true, force: true }));

/** Each check's verdict: whether the library accepts the value, or declares nothing. */
function verdicts(checks: readonly Check[]): ("accepted" | "rejected" | "missing")[] {
  const vue = packageFolder("packages/target-vue", "vue");
  const svelte = packageFolder("packages/target-svelte", "svelte");
  const paths = {
    "@vue/runtime-dom": [
      typesOf(
        dirname(createRequire(join(vue, "package.json")).resolve("@vue/runtime-dom/package.json")),
      ),
    ],
    react: [typesOf(packageFolder("packages/target-react", "@types/react"))],
    "solid-js": [typesOf(packageFolder("packages/target-solid", "solid-js"))],
    "@qwik.dev/core": [typesOf(packageFolder("packages/target-qwik", "@qwik.dev/core"))],
    "svelte/elements": [join(svelte, "elements.d.ts")],
  };
  const astro = join(packageFolder("packages/target-astro", "astro"), "astro-jsx.d.ts");
  writeFileSync(
    join(folder, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: [],
        lib: ["esnext", "dom", "dom.iterable"],
        module: "esnext",
        moduleResolution: "bundler",
        target: "esnext",
        allowImportingTsExtensions: true,
        paths,
      },
      files: ["probe.ts", astro],
    }),
  );
  const lines = checks.map(
    (check, index) =>
      `export const c${index}: A<${check.value}, P<${check.library.elements}, ${JSON.stringify(check.tag)}, ${JSON.stringify(check.library.key(check.namespace, check.name))}>> = 3;`,
  );
  writeFileSync(join(folder, "probe.ts"), [...HEADER, ...lines].join("\n"));
  const require = createRequire(import.meta.url);
  const manifestPath = require.resolve("typescript/package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { bin: { tsc: string } };
  const result = spawnSync(
    process.execPath,
    [
      join(dirname(manifestPath), manifest.bin.tsc),
      "-p",
      join(folder, "tsconfig.json"),
      "--pretty",
      "false",
    ],
    { cwd: folder, encoding: "utf8", maxBuffer: 1 << 28 },
  );
  if (result.error) throw new Error(`could not start tsc: ${result.error.message}`);
  const found = new Map<number, string>();
  const unexpected: string[] = [];
  for (const line of `${result.stdout}${result.stderr}`.split("\n")) {
    if (!line.trim()) continue;
    const match = VERDICT.exec(line);
    if (match) found.set(Number(match[1]) - HEADER.length - 1, match[2]!);
    else unexpected.push(line);
  }
  if (unexpected.length)
    throw new Error(`tsc reported more than the probes:\n${unexpected.slice(0, 20).join("\n")}`);
  return checks.map((check, index) => {
    const verdict = found.get(index);
    if (verdict === undefined)
      throw new Error(
        `no verdict for ${JSON.stringify({ ...check, library: check.library.name })}`,
      );
    return verdict === "1" ? "accepted" : verdict === "0" ? "rejected" : "missing";
  });
}

interface Pair {
  readonly namespace: Namespace;
  readonly tag: string;
  readonly name: string;
}

/**
 * Every attribute of every element a component can render, but `class` and `style`, which have
 * forms of their own; with whether the analyser accepts its name.
 */
function pairs(): (Pair & { readonly named: boolean })[] {
  const found: (Pair & { readonly named: boolean })[] = [];
  const add = (namespace: Namespace, tag: string, names: Iterable<string>) => {
    for (const name of new Set(names)) {
      if (name === "class" || name === "style") continue;
      const known = namespace === "html" ? isHtmlAttribute(tag, name) : isSvgAttribute(tag, name);
      if (!known) continue;
      found.push({ namespace, tag, name, named: !nameProblem(tag, namespace, name, name, true) });
    }
  };
  for (const tag of HTML_ELEMENTS) {
    if (UNRENDERABLE_ELEMENTS.has(tag) || UNPORTABLE_ELEMENTS.has(tag)) continue;
    add("html", tag, [
      ...GLOBAL_ATTRIBUTES,
      ...(ELEMENT_ATTRIBUTES.get(tag) ?? []),
      ...ARIA_ATTRIBUTES,
    ]);
  }
  for (const tag of SVG_ELEMENTS) {
    add("svg", tag, [
      ...SVG_GLOBAL_ATTRIBUTES,
      ...(SVG_ELEMENT_ATTRIBUTES.get(tag) ?? []),
      ...ARIA_ATTRIBUTES,
    ]);
  }
  return found;
}

const tokensType = (tokens: readonly string[]): string =>
  tokens.map((token) => JSON.stringify(token)).join(" | ");

const accepts = (pair: Pair, kinds: Kinds): boolean =>
  boundValueProblem(pair.tag, pair.namespace, pair.name, kinds) === undefined;

/**
 * The attribute names the Vue toolchain's strict templates allow beside Vue's types
 * (`vueCompilerOptions.dataAttributes`, as patterns).
 */
function vueAllowedAttributes(): RegExp[] {
  const config = readFileSync(new URL("tests/toolchains/vue/tsconfig.json", ROOT), "utf8")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
  const options = (JSON.parse(config) as { vueCompilerOptions?: { dataAttributes?: string[] } })
    .vueCompilerOptions;
  return (options?.dataAttributes ?? []).map(
    (pattern) =>
      new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`),
  );
}

const where = (pair: Pair): string => `${pair.namespace} <${pair.tag}> ${pair.name}`;

/** The kinds of value probed without literals: the analyser accepts them by kind. */
const PRIMITIVES = ["string", "number", "boolean"] as const;

describe("bound values against the targets' element types", () => {
  const known = pairs();
  // The attributes the analyser accepts by name, whose values it checks.
  const all = known.filter((pair) => pair.named);
  // Every kind of value on every attribute, and an enumerated attribute's tokens.
  const checks: Check[] = [];
  const kindsOf = new Map<string, Kinds>([
    ["string", STRING],
    ["number", NUMBER],
    ["boolean", BOOLEAN],
  ]);
  for (const pair of known) {
    const values = enumeratedValues(pair.tag, pair.namespace, pair.name);
    // A name the analyser rejects is probed for whether the targets declare it.
    const probed: string[] = pair.named ? [...PRIMITIVES] : ["string"];
    if (pair.named && values?.tokens.length) probed.push(tokensType(values.tokens));
    // The static values a target converts itself, which the others take as written.
    const converted = pair.named
      ? (staticTokens(pair.tag, pair.namespace, pair.name) ?? []).filter(
          (token) => !values?.tokens.includes(token),
        )
      : [];
    probed.push(...converted.map((token) => JSON.stringify(token)));
    for (const value of probed) {
      for (const library of LIBRARIES) checks.push({ ...pair, value, library });
    }
  }
  const verdictOf = new Map<string, "accepted" | "rejected" | "missing">();
  const results = verdicts(checks);
  results.forEach((verdict, index) => {
    const check = checks[index]!;
    verdictOf.set(`${where(check)}\t${check.value}\t${check.library.name}`, verdict);
  });
  const verdictFor = (pair: Pair, value: string, library: string) =>
    verdictOf.get(`${where(pair)}\t${value}\t${library}`);
  const rejecters = new Map<string, Set<string>>();
  results.forEach((verdict, index) => {
    if (verdict !== "rejected") return;
    const check = checks[index]!;
    const id = `${where(check)}\t${check.value}`;
    (rejecters.get(id) ?? rejecters.set(id, new Set()).get(id)!).add(check.library.name);
  });
  const rejectedBy = (pair: Pair, value: string): ReadonlySet<string> =>
    rejecters.get(`${where(pair)}\t${value}`) ?? new Set();

  it("probes every attribute the tables know, on every target", () => {
    expect(all.length).toBeGreaterThan(10_000);
    // A target whose types did not resolve, or whose names are wrong, declares little.
    for (const library of LIBRARIES) {
      const own = results.filter((_, index) => checks[index]!.library === library);
      const declared = own.filter((verdict) => verdict !== "missing").length / own.length;
      expect(declared, library.name).toBeGreaterThan(0.8);
    }
  });

  it("accepts only values every target's types accept", () => {
    // Grouped by attribute, value and targets, with the elements where it happens.
    const violations = new Map<string, string[]>();
    const violation = (pair: Pair, problem: string) => {
      const id = `${pair.namespace} ${pair.name}: ${problem}`;
      (violations.get(id) ?? violations.set(id, []).get(id)!).push(pair.tag);
    };
    const tokenChecks: Check[] = [];
    for (const pair of all) {
      for (const value of PRIMITIVES) {
        const libraries = rejectedBy(pair, value);
        if (libraries.size && accepts(pair, kindsOf.get(value)!)) {
          violation(pair, `${[...libraries].join(", ")} reject any ${value}`);
        }
      }
      const values = enumeratedValues(pair.tag, pair.namespace, pair.name);
      if (!values?.tokens.length) continue;
      // Where the attribute binds at all, its tokens bind.
      if (accepts(pair, UNKNOWN) && !accepts(pair, union(...values.tokens.map(stringLiteral)))) {
        violation(pair, "the analyser rejects its tokens");
      }
      const libraries = rejectedBy(pair, tokensType(values.tokens));
      for (const library of LIBRARIES.filter((item) => libraries.has(item.name))) {
        for (const token of values.tokens) {
          tokenChecks.push({ ...pair, value: JSON.stringify(token), library });
        }
      }
    }
    // Name the tokens a target rejects: a second, smaller run.
    if (tokenChecks.length) {
      verdicts(tokenChecks).forEach((verdict, index) => {
        const check = tokenChecks[index]!;
        if (verdict === "rejected")
          violation(check, `${check.library.name} rejects ${check.value}`);
      });
    }
    const elements = new Map<string, number>();
    for (const pair of all) {
      const id = `${pair.namespace} ${pair.name}`;
      elements.set(id, (elements.get(id) ?? 0) + 1);
    }
    expect(
      [...violations].map(([id, tags]) => {
        const every = tags.length === elements.get(id.slice(0, id.indexOf(":")));
        return `${id} (${every ? "on every element" : `on <${tags.slice(0, 3).join(">, <")}>${tags.length > 3 ? ` and ${tags.length - 3} more` : ""}`})`;
      }),
    ).toEqual([]);
  });

  it("lists as a string only what some target declares so", () => {
    const names = new Map<string, Pair[]>();
    for (const pair of all) {
      if (!isTargetStringAttribute(pair.tag, pair.namespace, pair.name)) continue;
      const id = `${pair.namespace} ${pair.name}`;
      (names.get(id) ?? names.set(id, []).get(id)!).push(pair);
    }
    expect(names.size).toBeGreaterThan(30);
    const loose = [...names]
      .filter(([, found]) => !found.some((pair) => rejectedBy(pair, "number").size))
      .map(([id]) => id);
    expect(loose).toEqual([]);
  });

  it("lists only attributes some target restricts, with a boolean only where every target takes one", () => {
    const groups = new Map<string, { values: Enumerated; pairs: Pair[] }>();
    const ids = new Map<Enumerated, number>();
    for (const pair of all) {
      const values = enumeratedValues(pair.tag, pair.namespace, pair.name);
      if (!values) continue;
      if (!ids.has(values)) ids.set(values, ids.size);
      const id = `${pair.namespace} ${pair.name} #${ids.get(values)}`;
      (groups.get(id) ?? groups.set(id, { values, pairs: [] }).get(id)!).pairs.push(pair);
    }
    const loose: string[] = [];
    const booleans: string[] = [];
    for (const [id, group] of groups) {
      if (!group.pairs.some((pair) => rejectedBy(pair, "string").size)) loose.push(id);
      const boolean = group.pairs.every((pair) => !rejectedBy(pair, "boolean").size);
      if (boolean !== group.values.boolean)
        booleans.push(`${id}: every target takes a boolean: ${boolean}`);
    }
    expect(groups.size).toBeGreaterThan(100);
    expect(loose).toEqual([]);
    expect(booleans).toEqual([]);
  });
  // TSX checks the attributes a JSX element is given, but those whose name has a hyphen, and
  // Vue's strict templates check every one, but those its toolchain allows (`dataAttributes`);
  // svelte-check checks every one too. Angular's `[attr.x]` checks none.
  it("accepts by name only what the authoring types, React's and Vue's declare, and ARIA's that Svelte's do", () => {
    const allowed = vueAllowedAttributes();
    const undeclared = new Set<string>();
    for (const pair of all) {
      for (const library of LIBRARIES) {
        const key = library.key(pair.namespace, pair.name);
        const checked =
          library.name === "Authoring" || library.name === "React"
            ? !key.includes("-")
            : library.name === "Vue"
              ? !allowed.some((pattern) => pattern.test(key))
              : library.name === "Svelte" && pair.name.startsWith("aria-");
        if (checked && verdictFor(pair, "string", library.name) === "missing") {
          undeclared.add(`${library.name}: ${where(pair)}`);
        }
      }
    }
    expect(allowed.length).toBeGreaterThan(0);
    expect([...undeclared]).toEqual([]);
  });

  it("rejects a name for the frameworks whose types lack it, and only those", () => {
    const declared: string[] = [];
    let rejected = 0;
    for (const pair of known) {
      if (pair.named) continue;
      const frameworks = undeclaredBy(pair.tag, pair.namespace, pair.name);
      if (!frameworks) continue;
      rejected++;
      // Vue's types are the authoring types, which TSX checks for a name without a hyphen.
      const libraries: string[] = [...frameworks];
      if (frameworks.includes("Vue") && !pair.name.includes("-")) libraries.push("Authoring");
      for (const library of libraries) {
        if (verdictFor(pair, "string", library) !== "missing") {
          declared.push(`${library} declares ${where(pair)}`);
        }
      }
    }
    expect(rejected).toBeGreaterThan(300);
    expect(declared).toEqual([]);
  });

  it("accepts the static values a target converts, which the others' types take as written", () => {
    const problems: string[] = [];
    let probed = 0;
    for (const pair of all) {
      const values = enumeratedValues(pair.tag, pair.namespace, pair.name);
      for (const token of staticTokens(pair.tag, pair.namespace, pair.name) ?? []) {
        if (values?.tokens.includes(token)) continue;
        probed++;
        const rejecting = LIBRARIES.filter(
          (library) => verdictFor(pair, JSON.stringify(token), library.name) === "rejected",
        ).map((library) => library.name);
        // Qwik writes them as the boolean its types take; the conversion is needed.
        if (rejecting.join() !== "Qwik")
          problems.push(
            `${where(pair)} "${token}": ${rejecting.join(", ") || "no target"} rejects it`,
          );
      }
    }
    expect(probed).toBeGreaterThan(100);
    expect(problems).toEqual([]);
  });
});
