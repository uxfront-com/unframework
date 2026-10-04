// The emitter's output for M1's constructs (design §5.5), judged by Angular itself: sources
// lowered by the analyser and emitted as the compiler writes them pass ngtsc with strict
// templates and its extended diagnostics (L3), the toolchain's type check (L4) and its linters
// (L5) with no message, and Angular's server platform renders the DOM the source describes for
// the props given, left out or explicitly `undefined`. The render-parity kit compares every
// construct with the reference; these pin the shapes only Angular needs: the `@let` reads, a
// prop in a `track`, the defaults' transforms, the globals as members and template literals as
// concatenations.
// Angular's own packages ship partially compiled; in this plain-Node project the JIT compiler
// finishes them as they load (see render-parity.test.ts). The components are compiled ahead of
// time by ngtsc either way.
// oxlint-disable-next-line import/no-unassigned-import -- loaded for its side effect
import "@angular/compiler";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { format as formatMessage } from "node:util";

import type { OutputFile } from "@unframework/codegen";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { canonical } from "../../codegen/test/markup-cases.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { context, formatted, ngtscPlugin, removeScratch, scratchDir } from "./helpers.ts";

afterAll(removeScratch);

/** Sources by component name, each showing what Angular needs of the emitter. */
const SOURCES: Readonly<Record<string, string>> = {
  // Defaults: absent and `undefined` take them, `null` stays a value (design §1.1).
  Notice: `
type Tone = "info" | "warn" | undefined;

export interface NoticeProps {
  tone?: Tone;
  size?: number;
  label?: string | null;
  tags?: readonly string[];
}

export default function Notice({ tone = "info", size = 1000, label = null, tags = [] }: NoticeProps) {
  return (
    <p data-tone={tone} data-size={size}>
      {tone.toUpperCase()}|{label ?? "none"}|{tags.join(",")}
    </p>
  );
}
`,
  // Narrowing: TypeScript narrows each of these, and so does Angular through a variable.
  Owner: `
interface Person {
  name: string;
  email?: string;
}

export interface OwnerProps {
  owner?: Person;
  phone?: string | null;
  count?: number;
  tags: string[];
  value: string | number;
}

export default function Owner({ owner, phone, count, tags, value }: OwnerProps) {
  return (
    <div>
      {owner && <p>{owner.name.toUpperCase()}</p>}
      {owner?.email && <a href={\`mailto:\${owner.email}\`}>{owner.email.length}</a>}
      {phone ? <p>{phone.trim()}</p> : <p>no phone</p>}
      {count !== undefined && count > 0 && <p>{count.toFixed(1)}</p>}
      <p>{tags[0] && tags[0].toUpperCase()}</p>
      <p>{typeof value === "string" ? value.toUpperCase() : value.toFixed(2)}</p>
    </div>
  );
}
`,
  // A prop in a key is read from its input there; the index only the key reads is declared.
  Rows: `
export interface RowsProps {
  prefix: string;
  rows: { id: string; label: string }[];
}

export default function Rows({ prefix, rows }: RowsProps) {
  return (
    <ul>
      {rows.map((row) => <li key={prefix + row.id}>{prefix}{row.label}</li>)}
      {rows.map((row, index) => <li key={index}>{row.label.toUpperCase()}</li>)}
    </ul>
  );
}
`,
  // Globals are members; template literals are concatenations that never add numbers.
  Totals: `
export interface TotalsProps {
  values: number[];
  first: number;
  second: number;
}

export default function Totals({ values, first, second }: TotalsProps) {
  return (
    <p title={JSON.stringify(values)} style={{ width: \`\${first}px\` }}>
      {Math.max(...values)}|{\`\${first}\${second}\`}|{\`\${first + second}!\`}|{String(undefined)}
    </p>
  );
}
`,
  // The object form, and a component named after Angular's decorator.
  Component: `
export function Component(props: { author: string; minutes?: number }) {
  return <p>By {props.author}, {props.minutes ?? 1} min</p>;
}
`,
};

/** Each source's output, formatted as the compiler writes it, by component name. */
const outputs = new Map<string, OutputFile>();

beforeAll(async () => {
  for (const [name, source] of Object.entries(SOURCES)) {
    outputs.set(name, await formatted(source));
  }
});

describe("angular output", () => {
  it("passes Angular's compiler, its type check and its linters with no message", async () => {
    const directory = scratchDir();
    const files = [...outputs.values()].map((file) => ({
      path: join(directory, file.path),
      contents: file.contents,
    }));
    for (const file of files) writeFileSync(file.path, file.contents);
    const paths = files.map((file) => file.path);
    const [compiledFiles, checked, linted] = await Promise.all([
      toolchain.frameworkCompile(files, context),
      toolchain.typecheck(paths, context),
      toolchain.lint(paths, context),
    ]);
    const messages = (file: string) => [
      ...(compiledFiles.get(file)?.errors ?? []),
      ...(compiledFiles.get(file)?.warnings ?? []),
      ...(checked.get(file) ?? []),
      ...(linted.get(file) ?? []),
    ];
    expect(Object.fromEntries(paths.map((file) => [file, messages(file)]))).toEqual(
      Object.fromEntries(paths.map((file) => [file, []])),
    );
  });

  it.each([
    {
      name: "Notice",
      props: {},
      html: '<p data-tone="info" data-size="1000">INFO|none|</p>',
    },
    {
      name: "Notice",
      props: { tone: undefined, size: undefined, label: undefined, tags: undefined },
      html: '<p data-tone="info" data-size="1000">INFO|none|</p>',
    },
    {
      name: "Notice",
      props: { tone: "warn", size: 2, label: "a", tags: ["x", "y"] },
      html: '<p data-tone="warn" data-size="2">WARN|a|x,y</p>',
    },
    {
      name: "Owner",
      props: { phone: null, tags: [], value: 1.5 },
      html: "<div><p>no phone</p><p></p><p>1.50</p></div>",
    },
    {
      name: "Owner",
      props: { owner: { name: "ada", email: "a@b" }, phone: " 1 ", count: 2, tags: ["t"], value: "v" },
      html: '<div><p>ADA</p><a href="mailto:a@b">3</a><p>1</p><p>2.0</p><p>T</p><p>V</p></div>',
    },
    {
      name: "Rows",
      props: { prefix: "#", rows: [{ id: "1", label: "a" }, { id: "2", label: "b" }] },
      html: "<ul><li>#a</li><li>#b</li><li>A</li><li>B</li></ul>",
    },
    {
      name: "Totals",
      props: { values: [1, 3], first: 1, second: 2 },
      html: '<p title="[1,3]" style="width: 1px">3|12|3!|undefined</p>',
    },
    {
      name: "Component",
      props: { author: "Ada" },
      html: "<p>By Ada, 1 min</p>",
    },
  ])("renders $name for $props as the source does", async ({ name, props, html }) => {
    expect(canonical(await render(name, props))).toEqual(canonical(html));
  });
});

const rendered = new Map<string, unknown>();
let modules = 0;

/**
 * Compiles a component's output with ngtsc, whose warnings (extended diagnostics) fail it, and
 * renders it on Angular's server platform. Returns what its host element holds; anything
 * Angular logs fails it.
 */
async function render(name: string, props: Record<string, unknown>): Promise<string> {
  const file = outputs.get(name)!;
  let component = rendered.get(name);
  if (!component) {
    const directory = scratchDir();
    const { transform, warnings } = await ngtscPlugin();
    const { code } = await transform(join(directory, `${name}.uf.tsx.ts`), file.contents);
    expect(warnings).toEqual([]);
    const compiledFile = join(directory, `output-${modules++}.js`);
    writeFileSync(compiledFile, code);
    const loaded = (await import(pathToFileURL(compiledFile).href)) as Record<string, unknown>;
    component = loaded.default ?? loaded[name];
    rendered.set(name, component);
  }
  const logged: string[] = [];
  const capture = (...args: unknown[]) => void logged.push(formatMessage(...args));
  const spies = [
    vi.spyOn(console, "error").mockImplementation(capture),
    vi.spyOn(console, "warn").mockImplementation(capture),
  ];
  let html: string;
  try {
    html = await renderToString(component, { props });
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
  expect(logged).toEqual([]);
  const selector = /^<(uf-[a-z-]+) style="display: contents;">([\s\S]*)<\/\1>$/.exec(html);
  expect(selector, html).not.toBeNull();
  return selector![2]!;
}
