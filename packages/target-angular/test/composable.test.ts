// The composable and shared-module cases on Angular (ADR-0069, ADR-0070): each compiles through
// `compile()` with no error, and its outputs, the composables' modules and the copied `.ts`
// modules among them, pass ngtsc with strict templates (L3, L4) and the lint rules (L5) as the
// corpus's toolchain project runs them. The cases wait in `tests/integration/pending/` until every
// target's lane has landed (../../codegen/test/composable-cases.ts).
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { kebabCase } from "@unframework/codegen";
import type { OutputFile, ToolchainContext } from "@unframework/codegen";
import { afterAll, describe, expect, it } from "vitest";

import { compileComposableCases } from "../../codegen/test/composable-cases.ts";
import type { CompiledCase } from "../../codegen/test/composable-cases.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { context as corpus, packageDir, removeScratch, scratchDir, writeFiles } from "./helpers.ts";

const context: ToolchainContext = { ...corpus, root: packageDir };
const cases = await compileComposableCases("angular");

afterAll(removeScratch);

/**
 * Checks a compiled case: no error, a component file for each `.uf.tsx` source and a module for
 * each `.uf.ts` one, and every output clean through ngtsc (L3), the typecheck (L4) and the lint
 * rules (L5). Returns the outputs by path.
 */
async function expectClean({ sources }: CompiledCase): Promise<Map<string, string>> {
  const errors = sources.flatMap(({ diagnostics }) =>
    diagnostics.filter(({ severity }) => severity === "error"),
  );
  expect(errors).toEqual([]);
  for (const { filename, outputs } of sources) {
    const name = basename(filename).replace(/\.uf\.tsx?$/, "");
    expect(outputs.map(({ path }) => path)).toContain(`${kebabCase(name)}.ts`);
  }
  // Two sources that import one module each copy it, the same.
  const files = new Map<string, string>();
  for (const output of sources.flatMap(({ outputs }): OutputFile[] => outputs)) {
    expect(files.get(output.path) ?? output.contents, output.path).toBe(output.contents);
    files.set(output.path, output.contents);
  }
  const paths = writeFiles(scratchDir(), Object.fromEntries(files));
  const compiled = await toolchain.frameworkCompile(
    [...files].map(([path, contents]) => ({ path: paths[path]!, contents })),
    context,
  );
  for (const path of Object.values(paths)) {
    expect(compiled.get(path), path).toEqual({ errors: [], warnings: [] });
  }
  const checked = await toolchain.typecheck(Object.values(paths), context);
  for (const [path, messages] of checked) expect(messages, path).toEqual([]);
  const linted = await toolchain.lint(Object.values(paths), context);
  for (const [path, messages] of linted) expect(messages, path).toEqual([]);
  return files;
}

describe("angular composable cases", () => {
  it.each(cases)("compiles $id and passes L3 to L5", { timeout: 60_000 }, async (each) => {
    await expectClean(each);
  });
});

/**
 * Call sites the cases don't reach, each a case of its own, written under a scratch `pending/`
 * and compiled through the same helper.
 */
const CALLS: Record<string, Record<string, string>> = {
  // A getter the composable reads while it sets up, of a required input (NG0950 in a field).
  "calls/getter-input": {
    "useEager.uf.ts": [
      'import { ref } from "unframework";',
      "",
      "export function useEager(name: () => string) {",
      "  const first = ref(name());",
      "  return { first };",
      "}",
    ].join("\n"),
    "Greeting.uf.tsx": [
      'import { useEager } from "./useEager.uf.ts";',
      "",
      "export default function Greeting({ name }: { name: string }) {",
      "  const { first } = useEager(() => name);",
      "  return <p>Hello, {first.value}</p>;",
      "}",
    ].join("\n"),
  },
  // A generic composable whose value argument reads an input: `T` is the input's type.
  "calls/generic-input": {
    "useLatest.uf.ts": [
      'import { ref } from "unframework";',
      "",
      "export function useLatest<T>(initial: T) {",
      "  const current = ref(initial);",
      "  function set(next: T) {",
      "    current.value = next;",
      "  }",
      "  return { current, set };",
      "}",
    ].join("\n"),
    "Counter.uf.tsx": [
      'import { useLatest } from "./useLatest.uf.ts";',
      "",
      "export default function Counter({ start }: { start: number }) {",
      "  const { current, set } = useLatest(start);",
      "  return (",
      '    <button type="button" onClick={() => set(current.value + 1)}>',
      "      {current.value + 1}",
      "    </button>",
      "  );",
      "}",
    ].join("\n"),
  },
  // A generic composable with effects after the caller's own hook: called in the constructor.
  "calls/generic-constructor": {
    "useTracked.uf.ts": [
      'import { onMounted, ref } from "unframework";',
      "",
      "export function useTracked<T>(initial: T) {",
      "  const current = ref(initial);",
      "  onMounted(() => {",
      "    current.value = initial;",
      "  });",
      "  return { current };",
      "}",
    ].join("\n"),
    "Tracker.uf.tsx": [
      'import { onMounted, ref } from "unframework";',
      "",
      'import { useTracked } from "./useTracked.uf.ts";',
      "",
      "export default function Tracker() {",
      "  const mounted = ref(false);",
      "  onMounted(() => {",
      "    mounted.value = true;",
      "  });",
      "  const { current } = useTracked(1);",
      "  return (",
      "    <p>",
      '      {current.value + 1} {mounted.value ? "Mounted" : "Waiting"}',
      "    </p>",
      "  );",
      "}",
    ].join("\n"),
  },
  // Module values named like an event and the `style` input, and module constants named as a
  // watcher's locals would be.
  "calls/module-names": {
    "api.ts": ["export function save(text: string): string {", "  return `${text}!`;", "}"].join(
      "\n",
    ),
    "Editor.uf.tsx": [
      'import { defineEmits, ref, watch } from "unframework";',
      "",
      'import { save } from "./api";',
      "",
      'const style = "Plain";',
      "const currentCount = 3;",
      "const lastCount = 4;",
      "",
      "export default function Editor() {",
      "  const emit = defineEmits<{ save: [text: string] }>();",
      "  const count = ref(0);",
      "  watch(count, (next, previous) => {",
      "    console.log(next, previous, currentCount, lastCount);",
      "  });",
      "  return (",
      '    <button type="button" onClick={() => emit("save", save(style))}>',
      '      {style} {save("draft")} {count.value}',
      "    </button>",
      "  );",
      "}",
    ].join("\n"),
  },
  // A holder named like the `style` input a root element takes.
  "calls/holder-style": {
    "useStyle.uf.ts": [
      'import { ref } from "unframework";',
      "",
      "export function useStyle() {",
      '  const color = ref("red");',
      "  function toggle() {",
      '    color.value = color.value === "red" ? "blue" : "red";',
      "  }",
      "  return { color, toggle };",
      "}",
    ].join("\n"),
    "Swatch.uf.tsx": [
      'import { useStyle } from "./useStyle.uf.ts";',
      "",
      "export default function Swatch() {",
      "  const { color, toggle } = useStyle();",
      "  return (",
      '    <button type="button" onClick={() => toggle()}>',
      "      {color.value}",
      "    </button>",
      "  );",
      "}",
    ].join("\n"),
  },
  // A callback that reads an input: a composable calls it only from client code (UF2035), once
  // the inputs are set, so the call stays a field.
  "calls/callback-input": {
    "useAnnounce.uf.ts": [
      'import { onMounted, ref } from "unframework";',
      "",
      "export function useAnnounce(say: (text: string) => void) {",
      "  const said = ref(false);",
      "  onMounted(() => {",
      '    say("ready");',
      "    said.value = true;",
      "  });",
      "  return { said };",
      "}",
    ].join("\n"),
    "Announcer.uf.tsx": [
      'import { ref } from "unframework";',
      "",
      'import { useAnnounce } from "./useAnnounce.uf.ts";',
      "",
      "export default function Announcer({ name }: { name: string }) {",
      '  const last = ref("");',
      "  const { said } = useAnnounce((text) => {",
      "    last.value = `${name} is ${text}`;",
      "  });",
      "  return (",
      "    <p>",
      '      {last.value} {said.value ? "said" : "waiting"}',
      "    </p>",
      "  );",
      "}",
    ].join("\n"),
  },
  // A call with effects in `ngOnInit` between the caller's mounted hooks: the later hook follows
  // it there (semantics contract, effect order).
  "calls/order-init": {
    "useLabelled.uf.ts": [
      'import { onMounted, ref } from "unframework";',
      "",
      "export function useLabelled(report: (entry: string) => void, label: () => string) {",
      "  const seen = ref(label());",
      "  onMounted(() => report(`composable mounted ${label()}`));",
      "  return { seen };",
      "}",
    ].join("\n"),
    "Labelled.uf.tsx": [
      'import { onMounted, ref } from "unframework";',
      "",
      'import { useLabelled } from "./useLabelled.uf.ts";',
      "",
      "export default function Labelled({ label }: { label: string }) {",
      "  const entries = ref<string[]>([]);",
      "  function record(entry: string) {",
      "    entries.value = [...entries.value, entry];",
      "  }",
      '  onMounted(() => record("caller mounted first"));',
      "  const { seen } = useLabelled(",
      "    (entry) => record(entry),",
      "    () => label,",
      "  );",
      '  onMounted(() => record("caller mounted last"));',
      "  return (",
      "    <section>",
      '      <p role="status">{seen.value}</p>',
      "      <ol>",
      "        {entries.value.map((entry, index) => (",
      "          <li key={index}>{entry}</li>",
      "        ))}",
      "      </ol>",
      "    </section>",
      "  );",
      "}",
    ].join("\n"),
  },
  // A call with a watcher after the caller's watcher, which `ngOnInit` creates: the call follows
  // it there.
  "calls/order-watch": {
    "useCounted.uf.ts": [
      'import { ref, watch } from "unframework";',
      "",
      "export function useCounted(report: (entry: string) => void) {",
      "  const count = ref(0);",
      '  watch(count, () => report("composable watcher"));',
      "  function increment() {",
      "    count.value++;",
      "  }",
      "  return { count, increment };",
      "}",
    ].join("\n"),
    "Bumper.uf.tsx": [
      'import { ref, watch } from "unframework";',
      "",
      'import { useCounted } from "./useCounted.uf.ts";',
      "",
      "export default function Bumper() {",
      "  const entries = ref<string[]>([]);",
      "  const bumps = ref(0);",
      "  function record(entry: string) {",
      "    entries.value = [...entries.value, entry];",
      "  }",
      "  watch(",
      "    () => bumps.value,",
      '    () => record("caller watcher"),',
      "  );",
      "  const { count, increment } = useCounted((entry) => record(entry));",
      "  function bump() {",
      "    bumps.value++;",
      "    increment();",
      "  }",
      "  return (",
      "    <section>",
      '      <p role="status">Count: {count.value}</p>',
      '      <button type="button" onClick={() => bump()}>',
      "        Bump",
      "      </button>",
      "      <ol>",
      "        {entries.value.map((entry, index) => (",
      "          <li key={index}>{entry}</li>",
      "        ))}",
      "      </ol>",
      "    </section>",
      "  );",
      "}",
    ].join("\n"),
  },
  // Handlers that only call a function imported from a `.ts` module, one named like an output.
  "calls/module-handler": {
    "api.ts": [
      "export function save(text: string): string {",
      "  return text;",
      "}",
      "",
      "export function track(text: string): void {",
      "  void text;",
      "}",
    ].join("\n"),
    "Actions.uf.tsx": [
      'import { defineEmits } from "unframework";',
      "",
      'import { save, track } from "./api";',
      "",
      "const ping = (text: string): string => text;",
      "",
      "export default function Actions() {",
      "  const emit = defineEmits<{ save: [text: string] }>();",
      "  return (",
      "    <div>",
      '      <button type="button" onClick={() => save("y")}>',
      "        Save",
      "      </button>",
      '      <button type="button" onClick={() => track("z")}>',
      "        Track",
      "      </button>",
      '      <button type="button" onClick={() => emit("save", "x")}>',
      "        Emit",
      "      </button>",
      '      <button type="button" onClick={() => ping("p")}>',
      "        Ping",
      "      </button>",
      "    </div>",
      "  );",
      "}",
    ].join("\n"),
  },
  // `watchEffect`s after a call with effects in `ngOnInit`, with and without a cleanup: they are
  // registered there after it, with the component's injector, a cleanup's ref assigned there.
  "calls/late-effects": {
    "useSeen.uf.ts": [
      'import { onMounted, ref } from "unframework";',
      "",
      "export function useSeen(label: () => string) {",
      "  const seen = ref(label());",
      "  onMounted(() => {",
      "    seen.value = label();",
      "  });",
      "  return { seen };",
      "}",
    ].join("\n"),
    "Seen.uf.tsx": [
      'import { ref, watchEffect } from "unframework";',
      "",
      'import { useSeen } from "./useSeen.uf.ts";',
      "",
      "export default function Seen({ label }: { label: string }) {",
      '  const last = ref("");',
      "  const count = ref(0);",
      "  const { seen } = useSeen(() => label);",
      "  watchEffect(() => {",
      "    count.value = seen.value.length;",
      "  });",
      "  watchEffect((onCleanup) => {",
      "    last.value = `seen ${seen.value}`;",
      "    onCleanup(() => {",
      '      last.value = "";',
      "    });",
      "  });",
      "  return (",
      "    <p>",
      "      {last.value} {count.value}",
      "    </p>",
      "  );",
      "}",
    ].join("\n"),
  },
  // A second call with effects after one in `ngOnInit`, which follows it there though it reads
  // no input.
  "calls/two-calls": {
    "useSeen.uf.ts": [
      'import { onMounted, ref } from "unframework";',
      "",
      "export function useSeen(label: () => string) {",
      "  const seen = ref(label());",
      "  onMounted(() => {",
      "    seen.value = label();",
      "  });",
      "  return { seen };",
      "}",
    ].join("\n"),
    "useTicks.uf.ts": [
      'import { onMounted, ref } from "unframework";',
      "",
      "export function useTicks() {",
      "  const ticks = ref(0);",
      "  onMounted(() => {",
      "    ticks.value++;",
      "  });",
      "  return { ticks };",
      "}",
    ].join("\n"),
    "Pair.uf.tsx": [
      'import { useSeen } from "./useSeen.uf.ts";',
      'import { useTicks } from "./useTicks.uf.ts";',
      "",
      "export default function Pair({ label }: { label: string }) {",
      "  const { seen } = useSeen(() => label);",
      "  const { ticks } = useTicks();",
      "  return (",
      "    <p>",
      "      {seen.value} {ticks.value}",
      "    </p>",
      "  );",
      "}",
    ].join("\n"),
  },
};

/**
 * The body of the component's method, `ngOnInit(): void` or `constructor()`, by its head: the
 * component is the file's last class, after the directives (`ufScope`'s `ngOnInit`).
 */
function methodBody(code: string, head: string): string {
  const start = code.lastIndexOf(`  ${head} {\n`);
  if (start === -1) return "";
  const end = code.indexOf("\n  }\n", start);
  return code.slice(start, end);
}

describe("angular composable call sites", () => {
  const integrationDir = scratchDir();
  for (const [id, files] of Object.entries(CALLS)) {
    const dir = join(integrationDir, "pending", id);
    mkdirSync(dir, { recursive: true });
    for (const [name, contents] of Object.entries(files)) {
      writeFileSync(join(dir, name), `${contents}\n`);
    }
  }
  const compiled = compileComposableCases("angular", { ids: Object.keys(CALLS), integrationDir });
  /** A case's component output, once the whole case passes L3 to L5. */
  const component = async (id: string, path: string) => {
    const files = await expectClean((await compiled).find((entry) => entry.id === id)!);
    return files.get(path)!;
  };

  it(
    "calls a composable in `ngOnInit` where a getter argument reads an input",
    { timeout: 60_000 },
    async () => {
      const code = await component("calls/getter-input", "greeting.ts");
      expect(methodBody(code, "ngOnInit(): void")).toMatch(
        /this\.eager = runInInjectionContext\(this\.\w+, \(\) => this\.createEager\(\)\)/,
      );
      expect(code).not.toMatch(/= useEager\(/);
    },
  );

  it(
    "keeps a generic composable's type argument where `ngOnInit` calls it",
    { timeout: 60_000 },
    async () => {
      const code = await component("calls/generic-input", "counter.ts");
      expect(methodBody(code, "ngOnInit(): void")).toMatch(
        /runInInjectionContext\(this\.\w+, \(\) => this\.createLatest\(\)\)/,
      );
      expect(code).toContain("ReturnType<typeof this.createLatest>");
    },
  );

  it(
    "keeps a generic composable's type argument where the constructor calls it",
    { timeout: 60_000 },
    async () => {
      const code = await component("calls/generic-constructor", "tracker.ts");
      expect(methodBody(code, "constructor()")).toMatch(/this\.tracked\w* = /);
      expect(methodBody(code, "ngOnInit(): void")).not.toMatch(/this\.tracked\w* = /);
      expect(code).toContain("ReturnType<typeof this.createTracked>");
    },
  );

  it(
    "reads module values by their module names, and the template through free members",
    { timeout: 60_000 },
    async () => {
      const code = await component("calls/module-names", "editor.ts");
      expect(code).toContain('import { save } from "./api";');
      expect(code).toContain('const style = "Plain";');
      // The watcher's locals leave the module's constants alone.
      expect(code).toContain("console.log(next, previous, currentCount, lastCount)");
      expect(code).not.toMatch(/^\s+(?:const|let) (?:currentCount|lastCount)\b/m);
    },
  );

  it("names a holder past the `class` and `style` inputs", { timeout: 60_000 }, async () => {
    const code = await component("calls/holder-style", "swatch.ts");
    expect(code).not.toMatch(/readonly style = useStyle\(/);
  });

  it(
    "calls a composable from a field where only a callback argument reads an input",
    { timeout: 60_000 },
    async () => {
      const code = await component("calls/callback-input", "announcer.ts");
      expect(code).toMatch(/protected readonly announce = runInInjectionContext\(/);
      expect(code).not.toContain("this.announce =");
    },
  );

  it(
    "registers the caller's later hooks after a call in `ngOnInit`, in source order",
    { timeout: 60_000 },
    async () => {
      const code = await component("calls/order-init", "labelled.ts");
      const constructor = methodBody(code, "constructor()");
      const init = methodBody(code, "ngOnInit(): void");
      expect(constructor).toContain('"caller mounted first"');
      expect(constructor).not.toContain('"caller mounted last"');
      const call = init.indexOf("this.labelled = ");
      const last = init.indexOf('"caller mounted last"');
      expect(call).toBeGreaterThan(-1);
      expect(last).toBeGreaterThan(call);
      expect(init.slice(last)).toMatch(/\{ injector: this\.injector \}/);
    },
  );

  it(
    "calls a composable with effects in `ngOnInit` after the caller's earlier watcher",
    { timeout: 60_000 },
    async () => {
      const code = await component("calls/order-watch", "bumper.ts");
      const init = methodBody(code, "ngOnInit(): void");
      const watcher = init.indexOf('"caller watcher"');
      const call = init.indexOf("this.counted = ");
      expect(watcher).toBeGreaterThan(-1);
      expect(call).toBeGreaterThan(watcher);
    },
  );

  it(
    "compiles a handler that calls a function imported from a module",
    { timeout: 60_000 },
    async () => {
      const code = await component("calls/module-handler", "actions.ts");
      expect(code).toContain('import { save, track } from "./api";');
      expect(code).toMatch(/\(click\)="void currentSave\('y'\)"/);
      expect(code).toMatch(/\(click\)="void track\('z'\)"/);
      expect(code).toMatch(/\(click\)="void ping\('p'\)"/);
    },
  );

  it(
    "registers `watchEffect`s after a call in `ngOnInit` there, with the injector",
    { timeout: 60_000 },
    async () => {
      const code = await component("calls/late-effects", "seen.ts");
      expect(methodBody(code, "constructor()")).not.toContain("afterRenderEffect");
      const init = methodBody(code, "ngOnInit(): void");
      const call = init.search(/this\.seen\w* = /);
      const effects = [...init.matchAll(/afterRenderEffect\(/g)].map(({ index }) => index);
      expect(call).toBeGreaterThan(-1);
      expect(effects).toHaveLength(2);
      for (const at of effects) expect(at).toBeGreaterThan(call);
      expect([...init.matchAll(/\{ injector: this\.injector \}/g)]).toHaveLength(2);
      // The cleanup's ref is assigned in `ngOnInit`: optional and writable.
      expect(code).toMatch(/private renderEffect\?: AfterRenderRef;/);
      expect(code).toContain("this.renderEffect?.destroy();");
    },
  );

  it(
    "calls a composable with effects in `ngOnInit` after another call there",
    { timeout: 60_000 },
    async () => {
      const code = await component("calls/two-calls", "pair.ts");
      const init = methodBody(code, "ngOnInit(): void");
      const first = init.search(/this\.seen\w* = /);
      const second = init.search(/this\.ticks\w* = /);
      expect(first).toBeGreaterThan(-1);
      expect(second).toBeGreaterThan(first);
    },
  );
});
