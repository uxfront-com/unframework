// The kinds the setup's bindings give (ADR-0046) against TypeScript's inference: a `ref`'s
// value widens a fresh literal (`ref(0)` holds a `number`) and keeps what it reads (`ref(size)`),
// a `computed` keeps a union of literals and widens a single one, a `const` keeps its literal and
// widens an object's or an array's members, and a local function returns what its `return`s give.
// Kinds that are too literal give false UF3023s, and too wide false UF3018s. The check runs the
// `tsc` executable over a generated probe, as `types-conformance` does: it never loads
// TypeScript's API. The probe declares `ref` and `computed` as the authoring package does, which
// the first test pins.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { parseModule } from "@unframework/parser";
import { afterAll, describe, expect, it } from "vitest";

import { analyzeModule } from "../src/analyze.ts";
import type { Kinds } from "../src/types/kinds.ts";

/** The authoring package's signatures the probe declares, as `src/index.ts` writes them. */
const SIGNATURES = [
  "export function ref<T>(value: T): Ref<T>;",
  "export function ref<T = undefined>(): Ref<T | undefined>;",
  "export function computed<T>(_getter: () => T): ComputedRef<T> {",
];

/** The probe's declarations: the authoring API's, without the brand, and the props'. */
const HEADER = [
  "interface Ref<T> { value: T }",
  "interface ComputedRef<T> { readonly value: T }",
  "declare function ref<T>(value: T): Ref<T>;",
  "declare function ref<T = undefined>(): Ref<T | undefined>;",
  "declare function computed<T>(getter: () => T): ComputedRef<T>;",
  "declare const flag: boolean;",
  'declare const size: "sm" | "md";',
  "type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;",
];

/** A declaration of the setup, and how the probe reads its binding's value. */
interface Case {
  /** The statement, which declares `x`. */
  declaration: string;
  /** What the probe reads the value as: `x.value`, `x`, or a call. */
  read: string;
}

const CASES: readonly Case[] = [
  ...[
    "ref(0)",
    'ref("x")',
    "ref(true)",
    "ref(flag ? 1 : 2)",
    'ref({ n: 1, s: "a" })',
    "ref([1, 2])",
    "ref([])",
    "ref(null)",
    "ref()",
    'ref<"a" | "b">("a")',
    "ref<string | null>(null)",
    "ref<number>()",
    "ref(size)",
    'ref({ kind: "a" as "a" | "b" })',
    'ref(flag ? "a" : size)',
    'computed(() => "x")',
    'computed(() => (flag ? "big" : "small"))',
    "computed(() => (flag ? 1 : 2))",
    'computed(() => (flag ? "a" : undefined))',
    'computed(() => flag && "a")',
    'computed(() => ({ t: "a" }))',
    "computed(() => [1, 2])",
    'computed(() => { return flag ? "x" : "y"; })',
    'computed(() => { if (flag) return "x"; return "y"; })',
    "computed(() => size)",
  ].map((value) => ({ declaration: `const x = ${value};`, read: "x.value" })),
  { declaration: "const x = 10;", read: "x" },
  { declaration: 'const x = flag ? "a" : "b";', read: "x" },
  { declaration: 'const x = ["a", "b"];', read: "x" },
  { declaration: "const x = { a: 1, b: [true] };", read: "x" },
  { declaration: "const x = `${size}!`;", read: "x" },
  { declaration: 'function x() { return "x"; }', read: "x()" },
  { declaration: 'function x() { return flag ? "a" : "b"; }', read: "x()" },
  { declaration: "const x = (): number => 1;", read: "x()" },
  { declaration: "const x = () => size;", read: "x()" },
];

/** The TypeScript type kinds stand for, as the probe writes it. */
function typeOf(kinds: Kinds): string {
  const parts: string[] = [];
  for (const primitive of kinds.primitives) {
    switch (primitive) {
      case "string":
        parts.push(
          ...(kinds.strings
            ? [...kinds.strings].map((value) => JSON.stringify(value))
            : ["string"]),
        );
        break;
      case "number":
        parts.push(...(kinds.numbers ? [...kinds.numbers].map(String) : ["number"]));
        break;
      case "boolean":
        parts.push(kinds.booleans?.size === 1 ? String([...kinds.booleans][0]) : "boolean");
        break;
      case "array": {
        const elements = (kinds.elements ?? []).map((element) => element());
        const element = elements.length ? elements.map(typeOf).join(" | ") : "never";
        parts.push(`(${element})[]`);
        break;
      }
      case "object":
        for (const shape of kinds.objects ?? []) {
          const members = [...shape.members()].map(
            ([name, member]) => `${name}${member.optional ? "?" : ""}: ${typeOf(member.kinds())}`,
          );
          parts.push(`{ ${members.join("; ")} }`);
        }
        if (!kinds.objects?.length) parts.push("object");
        break;
      default:
        parts.push(primitive);
    }
  }
  return parts.length ? parts.join(" | ") : "never";
}

/** The kinds the analyser gives `x` in a component with the declaration. */
function kindsOf(declaration: string): Kinds {
  const source = [
    'import { computed, ref } from "unframework";',
    'interface Props { flag: boolean; size: "sm" | "md" }',
    `export function A({ flag, size }: Props) { ${declaration} return <p title={String(flag) + size} />; }`,
  ].join("\n");
  let found: Kinds | undefined;
  const result = analyzeModule(parseModule("Probe.uf.tsx", source), (_, bindings) => {
    found = bindings.find((binding) => binding.name === "x")?.kinds;
  });
  const errors = result.diagnostics.filter(
    // `ref()` without a type is UF2021, whose kinds the test still reads.
    (diagnostic) =>
      diagnostic.severity === "error" &&
      diagnostic.code !== "UF3024" &&
      diagnostic.code !== "UF2021",
  );
  if (errors.length) throw new Error(`${declaration}: ${JSON.stringify(errors)}`);
  return found!;
}

const folder = mkdtempSync(join(tmpdir(), "uf-kinds-"));
afterAll(() => rmSync(folder, { recursive: true, force: true }));

/** Runs `tsc` over the probe: the lines it rejects, by case. */
function rejected(lines: readonly string[]): Map<number, string> {
  writeFileSync(
    join(folder, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, types: [], lib: ["esnext"], target: "esnext" },
      files: ["probe.ts"],
    }),
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
    { cwd: folder, encoding: "utf8" },
  );
  if (result.error) throw new Error(`could not start tsc: ${result.error.message}`);
  const found = new Map<number, string>();
  for (const line of `${result.stdout}${result.stderr}`.split("\n")) {
    const match = /probe\.ts\((\d+),\d+\): (.*)$/.exec(line);
    if (match) found.set(Number(match[1]) - HEADER.length - 1, match[2]!);
    else if (line.trim()) throw new Error(`tsc reported more than the probe: ${line}`);
  }
  return found;
}

describe("the setup's kinds", () => {
  it("declares the authoring API as the package does", () => {
    const index = readFileSync(new URL("../../unframework/src/index.ts", import.meta.url), "utf8");
    for (const signature of SIGNATURES) expect(index).toContain(signature);
  });

  it("are what TypeScript infers for each binding", { timeout: 60_000 }, () => {
    const expected = CASES.map((item) => typeOf(kindsOf(item.declaration)));
    const lines = CASES.map((item, index) => {
      const name = `x${index}`;
      const read =
        item.read === "x.value"
          ? `typeof ${name}.value`
          : item.read === "x()"
            ? `ReturnType<typeof ${name}>`
            : `typeof ${name}`;
      return `${item.declaration.replace(/\bx\b/, name)} const c${index}: Equal<${read}, ${expected[index]}> = true;`;
    });
    const mismatches = [...rejected(lines)].map(
      ([line, message]) => `${CASES[line]!.declaration} reads as ${expected[line]}: ${message}`,
    );
    expect(mismatches).toEqual([]);
  });
});
