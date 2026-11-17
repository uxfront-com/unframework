// L5 for Solid 2 (ADR-0042, ADR-0102): oxlint with the shared baseline and eslint-plugin-solid's
// v2 rules as a JS plugin (tests/toolchains/solid2/output.oxlintrc.json). It accepts every committed golden and
// the shapes M1 emits, rejects what its rules exist for (several of which fix how the emitter
// writes Solid), and refuses a run it cannot trust.
import { globSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ToolchainContext } from "@unframework.dev/codegen";
import { afterAll, describe, expect, it } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";
import { M1_SHAPES, M2_SHAPES } from "./lint-probes.ts";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const repo = join(packageDir, "../..");
const context: ToolchainContext = {
  toolchainDir: join(repo, "tests/toolchains/solid2"),
  root: packageDir,
};

/** Every Solid 2 golden output of the corpus. */
const goldens = globSync("tests/integration/cases/**/__output__/solid2/**/*.tsx", { cwd: repo })
  .toSorted()
  .map((file) => join(repo, file));

mkdirSync(join(packageDir, ".uf-tmp"), { recursive: true });
const scratch = mkdtempSync(join(packageDir, ".uf-tmp", "lint-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

let directories = 0;
/** Writes files into a directory of their own and returns their paths, in order. */
function write(files: Record<string, string>): string[] {
  const directory = join(scratch, String(directories++));
  mkdirSync(directory);
  return Object.entries(files).map(([name, contents]) => {
    const path = join(directory, name);
    writeFileSync(path, contents);
    return path;
  });
}

/** The codes of every message on one component, sorted. */
async function lintCodes(contents: string): Promise<string[]> {
  const [path] = write({ "Probe.tsx": contents });
  const messages = (await toolchain.lint([path!], context)).get(path!) ?? [];
  return messages.map((message) => message.code ?? message.message).toSorted();
}

/** The emitter's state helper, as src/helpers.ts prints it without watchers. */
const STATE = `
function createState<T>(initial: T): [() => T, (value: T) => void] {
  let current = initial;
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
`;

/** A component of `props` that returns `jsx`, with `head` above it. */
const component = (jsx: string, head = "") =>
  `${head}export default function Probe(props: { items: string[]; label: string }) {\n  return ${jsx};\n}\n`;

describe("solid2 lint (L5)", { timeout: 60_000 }, () => {
  // It checks every committed golden output, so its time grows with the corpus.
  it("accepts every committed golden output, with no message", async () => {
    expect(goldens.map((file) => file.split("/").at(-1))).toEqual(
      expect.arrayContaining(["Hello.tsx", "ProfileCard.tsx"]),
    );
    const results = await toolchain.lint(goldens, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(goldens.map((file) => [file, []])),
    );
  }, 60_000);

  it("accepts the shapes M1 emits", async () => {
    const files = write(M1_SHAPES);
    const results = await toolchain.lint(files, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(files.map((file) => [file, []])),
    );
  });

  it("accepts the shapes M2 emits (ADR-0045 to ADR-0049)", async () => {
    const files = write(M2_SHAPES);
    const results = await toolchain.lint(files, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(files.map((file) => [file, []])),
    );
  });

  it.each([
    {
      what: "destructured props",
      contents:
        "export default function Probe({ label }: { label: string }) {\n  return <p>{label}</p>;\n}\n",
      rule: "solid/no-destructure",
    },
    {
      what: "a list through `.map`",
      contents: component("<ul>{props.items.map((item) => <li>{item}</li>)}</ul>"),
      rule: "solid/prefer-for",
    },
    {
      what: "a conditional through a ternary",
      contents: component("<p>{props.label ? <b>{props.label}</b> : null}</p>"),
      rule: "solid/prefer-show",
    },
    {
      what: "React's attribute names",
      contents: component('<p className="x">{props.label}</p>'),
      rule: "solid/no-react-specific-props",
    },
    {
      what: "a camel-case style property",
      contents: component('<p style={{ fontSize: "12px" }}>{props.label}</p>'),
      rule: "solid/style-prop",
    },
    {
      what: "a style string",
      contents: component('<p style="color: red">{props.label}</p>'),
      rule: "solid/style-prop",
    },
    {
      // The rule asks for a unit on every property whose name holds width, height, margin,
      // padding or font-size: `line-height` and `border-image-width` too, which are unitless.
      // The emitter writes a number literal in a style as a string ("1.5"), which renders alike.
      what: "a number literal in a style",
      contents: component('<p style={{ "line-height": 1.5 }}>{props.label}</p>'),
      rule: "solid/style-prop",
    },
    {
      what: "an empty element that does not close itself",
      contents: component("<p>{props.label}<span></span></p>"),
      rule: "solid/self-closing-comp",
    },
    {
      what: "an index parameter no expression reads",
      contents: component(
        "<ul><For each={props.items}>{(item, index) => <li>{item}{props.label}</li>}</For></ul>",
        'import { For } from "solid-js";\n\n',
      ),
      rule: "no-unused-vars",
    },
    // M2: each rule pins a shape src/setup.ts, src/listeners.ts or src/helpers.ts prints.
    {
      what: "a prop the setup reads once outside `untrack`",
      contents:
        'import { createSignal } from "solid-js";\n\nexport default function Probe(props: { count: number }) {\n  const [count, setCount] = createSignal(props.count);\n  return <button type="button" onClick={() => setCount(count() + 1)}>{count()}</button>;\n}\n',
      rule: "solid/reactivity",
    },
    {
      what: "a getter passed to a helper not named as a primitive (`create…`)",
      contents:
        'import { createEffect } from "solid-js";\n\nexport default function Probe(props: { label: string }) {\n  watch(() => props.label);\n  return <p>{props.label}</p>;\n}\n\nfunction watch(source: () => string): void {\n  createEffect(source, (value) => {\n    console.log(value);\n  });\n}\n',
      rule: "solid/reactivity",
    },
    {
      // Solid 2 has no `on:`, so the second listener could only be a second prop.
      what: "two listeners of one event on one element as props",
      contents: component(
        '<button type="button" onClick={() => props.items.length} onClick={() => props.label}>x</button>',
      ),
      rule: "solid/jsx-no-duplicate-props",
    },
    {
      what: "a template ref as a `let` Solid's compiler assigns",
      contents:
        'export default function Probe(props: { label: string }) {\n  let field!: HTMLInputElement;\n  return <input name="x" ref={field} aria-label={props.label} />;\n}\n',
      rule: "no-unassigned-vars",
    },
    {
      // The emitter's state is `createState`, which `solid/no-unused-signal` does not read.
      what: "a setter no code calls",
      contents: `import { createSignal, getObserver } from "solid-js";\n\nexport default function Probe() {\n  const [count, setCount] = createState(0);\n  return <p>{count()}</p>;\n}\n${STATE}`,
      rule: "no-unused-vars",
    },
    {
      // Why an async `watchEffect` is no `createEffect`: the effect runs as a `create…` helper's
      // callback, which the rule reads as a function called later, async or not.
      what: "an async tracked scope (an async `watchEffect` as `createEffect(async …, …)`)",
      contents:
        'import { createEffect, createSignal } from "solid-js";\n\nexport default function Probe(props: { onSeen?: (value: number) => void }) {\n  const [count, setCount] = createSignal(0);\n  createEffect(\n    async () => {\n      const value = count();\n      await Promise.resolve();\n      props.onSeen?.(value);\n    },\n    () => undefined,\n  );\n  return <button type="button" onClick={() => setCount(count() + 1)}>{count()}</button>;\n}\n',
      rule: "solid/reactivity",
    },
    {
      what: "a microtask that reads a signal outside `untrack`",
      contents:
        'import { createSignal } from "solid-js";\n\nexport default function Probe(props: { onSaved?: (value: number) => void }) {\n  const [count, setCount] = createSignal(0);\n  function save() {\n    setCount(count() + 1);\n    queueMicrotask(() => props.onSaved?.(count()));\n  }\n  return <button type="button" onClick={save}>{count()}</button>;\n}\n',
      rule: "solid/reactivity",
    },
    {
      // So an arrow a setup function hands to a function says `untrack` (src/untracked.ts).
      what: "an arrow a setup function hands to a function, reading a signal outside `untrack`",
      contents:
        'import { createSignal } from "solid-js";\n\nexport default function Probe() {\n  const [items, setItems] = createSignal<number[]>([]);\n  const [draft, setDraft] = createSignal(1);\n  function update(change: (list: number[]) => number[]) {\n    setItems(change(items()));\n  }\n  function add() {\n    update((list) => [...list, draft()]);\n    setDraft(draft() + 1);\n  }\n  return <button type="button" onClick={add}>{items().length}</button>;\n}\n',
      rule: "solid/reactivity",
    },
    {
      what: "a statement no output has a reason to hold",
      contents:
        "export default function Probe(props: { label: string }) {\n  debugger;\n  return <p>{props.label}</p>;\n}\n",
      rule: "no-debugger",
    },
  ])("rejects $what ($rule)", async ({ contents, rule }) => {
    expect(await lintCodes(contents)).toEqual([rule]);
  });

  it("refuses to run without its configuration, or over a file it cannot lint", async () => {
    const [probe, notes] = write({
      "Probe.tsx": component("<p>{props.label}{props.items.length}</p>"),
      "notes.txt": "Hi\n",
    });
    await expect(
      toolchain.lint([probe!], { toolchainDir: scratch, root: packageDir }),
    ).rejects.toThrow(/output\.oxlintrc\.json does not exist/);
    await expect(toolchain.lint([probe!, notes!], context)).rejects.toThrow(
      /it linted 1 of the 2 files it was given, so it skipped some/,
    );
  });
});
