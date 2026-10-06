// The shapes this target chooses for props (design §5.2, ADR-0034), emitted from sources and run
// through the toolchain's L3 (@vue/compiler-sfc), L4 (vue-tsc with strict templates) and L5
// (oxlint and eslint-plugin-vue): each choice the emitter makes for a lint rule or a type check is
// pinned here, beside the goldens the other toolchain tests check.
import type { ToolchainContext } from "@unframework/codegen";
import { afterAll, describe, expect, it } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";
import { emitSource, packageDir, removeScratch, toolchainDir, writeScratch } from "./helpers.ts";

afterAll(removeScratch);

const context: ToolchainContext = { toolchainDir, root: packageDir };

/** Sources by the file their component is emitted to. */
const SHAPES: Readonly<Record<string, string>> = {
  // Optional props nothing reads keep their default in the pattern (`vue/require-default-prop`),
  // under a `_` local the unused-variable rule ignores; a required one nothing reads is left
  // out, and an unread boolean gets one too.
  "Partial.vue": `
export interface PartialProps {
  label: string;
  hidden: string;
  tone?: "info" | "warn";
  size?: number;
  quiet?: boolean;
}
export default function Partial({ label, hidden, tone, size = 2, quiet }: PartialProps) {
  return <p>{label}</p>;
}`,
  // No prop read: the macro alone, which the rule does not look at.
  "Unread.vue": `
export default function Unread({}: { label: string; tone?: string }) {
  return <p>Unread</p>;
}`,
  "UnreadObject.vue": `
export default function UnreadObject(props: { label: string; tone?: string }) {
  return <p>Unread</p>;
}`,
  "Required.vue": `
export default function Required(props: { label: string; count: number }) {
  return <p title={props.label}>{props.count}</p>;
}`,
  "Optional.vue": `
export default function Optional(props: { label: string; note?: string | null; tags?: string[] }) {
  return <p title={props.note ?? undefined}>{props.label}{props.tags?.join()}</p>;
}`,
  // Locals renamed away from a macro (TS2451 under vue-tsc) and from a template global.
  "Renamed.vue": `
export default function Renamed({ defineProps, console, require = "r", items }: { defineProps: string; console?: string; require?: string; items: string[] }) {
  return (
    <ul title={defineProps + require}>
      {items.map((item) => <li key={item}>{console ?? item}{JSON.stringify({ require })}</li>)}
    </ul>
  );
}`,
  "RenamedObject.vue": `
export default function RenamedObject(withDefaults: { title?: string; count: number }) {
  return <p title={withDefaults.title}>{withDefaults.count}</p>;
}`,
  // Defaults Vue turns into factories, and types it infers runtime props from.
  "Defaults.vue": `
type Tone = "info" | "warn";
interface Meta {
  by: string;
  year?: number;
}
export interface DefaultsProps {
  tags?: readonly string[];
  list?: Array<number>;
  meta?: Meta;
  tone?: Tone;
  level?: 1 | 2 | 3;
  note?: string | null;
  ratio?: number;
}
export default function Defaults({ tags = ["a"], list = [1, 2], meta = { by: "x" }, tone = "info", level = 1, note = null, ratio = -0.5 }: DefaultsProps) {
  return (
    <p class={tone} data-level={level} title={note ?? meta.by}>
      {tags.join()}{list.length}{ratio}
    </p>
  );
}`,
  "Inline.vue": `
export default function Inline({ label, on = false }: { label: string; on?: boolean }) {
  return <button type="button" disabled={on} aria-pressed={on}>{label}</button>;
}`,
  // Unread props whose `_` local is named like the parameters and helpers of Vue's compiled
  // code, and like nothing vue-tsc declares (render.test.ts renders it).
  "Internals.vue": `
export default function Internals({ label, items, cache = 1, openBlock = false }: { label: string; items: string[]; ctx?: string; cache?: number; push?: string; parent?: string; attrs?: string; openBlock?: boolean; toDisplayString?: string; normalizeClass?: string; renderList?: string; mergeProps?: string; defineComponent?: string; ssrRenderAttrs?: string; ssrInterpolate?: string }) {
  return <ul class={label}>{items.map((item) => <li key={item}>{item}</li>)}{label === "a" && <li>{label}</li>}</ul>;
}`,
};

describe("vue output shapes (L3, L4, L5)", { timeout: 60_000 }, () => {
  it("compile, type-check and lint clean", async () => {
    const emitted: Record<string, string> = {};
    for (const [name, source] of Object.entries(SHAPES)) emitted[name] = await emitSource(source);
    const paths = writeScratch(emitted);
    const files = Object.entries(paths).map(([name, path]) => ({ path, contents: emitted[name]! }));
    const [compiled, typed, linted] = await Promise.all([
      toolchain.frameworkCompile(files, context),
      toolchain.typecheck(Object.values(paths), context),
      toolchain.lint(Object.values(paths), context),
    ]);
    const problems = Object.entries(paths).flatMap(([name, path]) => {
      const { errors, warnings } = compiled.get(path)!;
      return [
        ...[...errors, ...warnings].map(({ message }) => `${name} L3: ${message}`),
        ...(typed.get(path) ?? []).map(({ code, message }) => `${name} L4 ${code}: ${message}`),
        ...(linted.get(path) ?? []).map(({ code, message }) => `${name} L5 ${code}: ${message}`),
      ];
    });
    expect(problems).toEqual([]);
  });

  // Why every optional prop stays in the pattern: the rule asks for each one's default.
  it("would fail L5 with an optional prop left out of the pattern", async () => {
    const contents = (await emitSource(SHAPES["Partial.vue"]!)).replace(
      /const \{[^}]*\}/,
      "const { label }",
    );
    const [path] = Object.values(writeScratch({ "Partial.vue": contents }));
    const messages = (await toolchain.lint([path!], context)).get(path!) ?? [];
    expect(messages.map(({ code }) => code)).toEqual([
      "vue/require-default-prop",
      "vue/require-default-prop",
    ]);
  });

  // Why an unread prop takes a `_` local: under its own name, it is an unused variable.
  it("would fail L5 with an unread optional prop under its own name", async () => {
    const contents = (await emitSource(SHAPES["Partial.vue"]!)).replaceAll(/(\w+): _\1 =/g, "$1 =");
    expect(contents).toContain("  tone = undefined,\n  size = 2,\n  quiet = undefined,\n");
    const [path] = Object.values(writeScratch({ "Partial.vue": contents }));
    const messages = (await toolchain.lint([path!], context)).get(path!) ?? [];
    expect(messages.map(({ code, message }) => `${code}: ${message.split(".")[0]}`)).toEqual([
      "@typescript-eslint/no-unused-vars: 'tone' is assigned a value but never used",
      "@typescript-eslint/no-unused-vars: 'size' is assigned a value but never used",
      "@typescript-eslint/no-unused-vars: 'quiet' is assigned a value but never used",
    ]);
  });

  // Why a prop named after a macro is declared under another local.
  it("would fail L4 with a local named after a macro", async () => {
    const contents = (await emitSource(SHAPES["Renamed.vue"]!))
      .replace("defineProps: defineProps_1", "defineProps")
      .replaceAll("defineProps_1", "defineProps");
    const [path] = Object.values(writeScratch({ "Renamed.vue": contents }));
    const codes = ((await toolchain.typecheck([path!], context)).get(path!) ?? []).map(
      ({ code }) => code,
    );
    expect(codes).toContain("TS2451");
  });
});
