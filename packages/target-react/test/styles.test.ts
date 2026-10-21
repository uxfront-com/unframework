// Scoped styles on React (ADR-0063): the sheet's import, the child-root rule through the inline
// `scopeAttributes` helper, and a slotted child's `-s` on the content a parent fills in, children
// and render props alike. Each source is lowered as `compile()` lowers it, with the sheets and the
// child APIs its resolver would read, and the child-root rule is rendered by React.
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { formatOutput } from "@unframework/codegen";
import type { ModuleApi, UfModule } from "@unframework/ir";
import { createElement } from "react";
import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { analyze } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";
import { packageDir } from "./fixtures.ts";

/** A child whose sheet uses `:slotted()`, with a default slot and a scoped one. */
const LIST = `import "./List.css";
import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function List({ names }: { names: string[] }) {
  const slots = defineSlots<{ default?(): Element; item?(props: { name: string }): Element }>();
  return (
    <section class="list">
      {slots.default?.()}
      {names.map((name) => (
        <p key={name}>{slots.item?.({ name })}</p>
      ))}
    </section>
  );
}`;

/** A styled parent that fills the child's default slot and its scoped one. */
const RANKING = `import "./Ranking.css";
import List from "./List.uf.tsx";

export default function Ranking({ names }: { names: string[] }) {
  return (
    <List names={names}>
      {{
        default: () => <h2 class="item">Podium</h2>,
        item: ({ name }) => <b class="item">{name}</b>,
      }}
    </List>
  );
}`;

/** A source lowered with the sheets and the child APIs its resolver gives, by specifier. */
function lowered(
  file: string,
  source: string,
  sheets: Record<string, string> = {},
  imports: Record<string, ModuleApi> = {},
): { module: UfModule; api: ModuleApi } {
  const { module, api, diagnostics } = analyze(parseModule(file, source), {
    stylesheets: new Map(
      Object.entries(sheets).map(([specifier, text]) => [
        specifier,
        { file: specifier.slice(2), source: text, slotted: text.includes(":slotted(") },
      ]),
    ),
    imports: new Map(Object.entries(imports)),
  });
  expect(diagnostics).toEqual([]);
  return { module: module!, api: api! };
}

/** The formatted React output of a module's component, its first by default. */
async function output(module: UfModule, index = 0): Promise<string> {
  const reported: unknown[] = [];
  const [file] = target.emit(module.components[index]!, {
    module,
    options: undefined,
    report: (diagnostic) => void reported.push(diagnostic),
  });
  expect(reported).toEqual([]);
  const outcome = await formatOutput(file!);
  expect(outcome.error).toBeUndefined();
  return outcome.file.contents;
}

describe("react scoped styles", () => {
  const list = lowered("List.uf.tsx", LIST, {
    "./List.css": ":slotted(.item) { color: green; }\n",
  });
  const ranking = lowered(
    "Ranking.uf.tsx",
    RANKING,
    { "./Ranking.css": ".item { margin: 0; }\n" },
    {
      "./List.uf.tsx": { ...list.api, file: "List.uf.tsx" },
    },
  );
  const listId = list.module.components[0]!.scopeId!;
  const rankingId = ranking.module.components[0]!.scopeId!;

  it("imports a styled component's sheet after its other imports", async () => {
    const code = await output(ranking.module);
    expect(code.split("\n\n")[0]).toBe(
      [
        'import List from "./List";',
        'import type { CSSProperties } from "react";',
        'import "./Ranking.uf.tsx.css";',
      ].join("\n"),
    );
  });

  it("stamps the child's `-s` on the children and on a render prop's content", async () => {
    const code = await output(ranking.module);
    const stamped = `className="item" data-uf-${rankingId}="" data-uf-${listId}-s=""`;
    // The child's tag takes the parent's attribute (the child-root rule), not the child's `-s`.
    expect(code).toContain(
      `style={style}\n      data-uf-${rankingId}=""\n      {...scopeAttributes(attributes)}\n      renderItem=`,
    );
    expect(code).toContain(`<h2 ${stamped}>`);
    expect(code).toContain(`renderItem={({ name }) => (\n        <b ${stamped}>`);
  });

  it("spreads the scope attributes its styled parents pass on the root of a styled child too", async () => {
    const code = await output(list.module);
    expect(code).toContain(`data-uf-${listId}=""\n      {...scopeAttributes(attributes)}\n    >`);
  });

  // The unplugin joins a source's outputs into one module (ADR-0053): a prop that takes the
  // helper's name moves the first component's helper on, and the second must not take it too.
  it("names the helper of each component of a source apart", async () => {
    const { module } = lowered(
      "Two.uf.tsx",
      `export function Item({ scopeAttributes }: { scopeAttributes: string }) {
  return <li>{scopeAttributes}</li>;
}
export default function Two() {
  return <ul><Item scopeAttributes="a" /></ul>;
}`,
    );
    const helpers = async (index: number) =>
      [...(await output(module, index)).matchAll(/^function (\w+)\(/gm)].map((match) => match[1]);
    expect([await helpers(0), await helpers(1)]).toEqual([
      ["scopeAttributes_1"],
      ["scopeAttributes_2"],
    ]);
  });

  // A local `const` an output hoists to module scope is declared in the joined module too, in an
  // earlier component or a later one.
  it.each([
    [
      "an earlier component's",
      `export function First() { const scopeAttributes = "local"; return <b title={scopeAttributes}>F</b>; }
export default function Second() { return <i>S</i>; }`,
    ],
    [
      "a later component's",
      `export function First() { return <b>F</b>; }
export default function Second() { const scopeAttributes = "local"; return <i title={scopeAttributes}>S</i>; }`,
    ],
    [
      "an earlier component's",
      `export function First() { const cx = "local"; return <><b title={cx}>F</b><i>G</i></>; }
export default function Second({ k }: { k: string }) { return <><b class={["a", k]}>S</b><i>T</i></>; }`,
    ],
  ])("leaves the helper's name to %s module-level const", async (_, source) => {
    const helper = source.includes("const cx") ? "cx" : "scopeAttributes";
    const { module } = lowered("Pair.uf.tsx", source);
    const declared = async (index: number) =>
      [...(await output(module, index)).matchAll(/^(?:function|const) (\w+)\b/gm)]
        .map((match) => match[1]!)
        .filter((name) => name === helper || name.startsWith(`${helper}_`));
    const [first, second] = [await declared(0), await declared(1)];
    expect(new Set([...first, ...second]).size).toBe(first.length + second.length);
  });
});

describe("react child-root rule, rendered by React", () => {
  const scratch = join(packageDir, ".uf-tmp", `styles-${randomUUID()}`);
  beforeAll(() => mkdirSync(scratch, { recursive: true }));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  /** Writes each source's output beside the others and loads the last one's component. */
  async function load(...sources: [file: string, source: string][]) {
    let path = "";
    for (const [file, source] of sources) {
      const { module } = lowered(file, source, {}, apis(sources, file));
      path = join(scratch, `${module.components[0]!.name}.tsx`);
      writeFileSync(path, await output(module));
    }
    return ((await import(path)) as { default: ComponentType<object> }).default;
  }

  /** The APIs of the sources before `file`, by the specifier a later one imports them with. */
  function apis(sources: [string, string][], file: string): Record<string, ModuleApi> {
    const before = sources.slice(
      0,
      sources.findIndex(([each]) => each === file),
    );
    return Object.fromEntries(
      before.map(([each, source]) => [
        `./${each}`,
        { ...analyze(parseModule(each, source)).api!, file: each },
      ]),
    );
  }

  /** React's markup for a component and its props, with what React warned about. */
  function render(component: ComponentType<object>, props: object) {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      return {
        html: renderToStaticMarkup(createElement(component, props)),
        errors: errors.mock.calls,
      };
    } finally {
      errors.mockRestore();
    }
  }

  const BUTTON = `export default function Button({ text, note }: { text: string; note?: string }) {
  return <button type="button" class="button">{text}</button>;
}`;

  it("puts the parents' scope attributes on its root, and no prop it leaves unread", async () => {
    const Button = await load(["Button.uf.tsx", BUTTON]);
    expect(
      render(Button, {
        text: "Save",
        note: "unread",
        "data-uf-0a1b2c3d": "",
        "data-uf-1a2b3c4d": "",
      }),
    ).toEqual({
      html: '<button type="button" class="button" data-uf-0a1b2c3d="" data-uf-1a2b3c4d="">Save</button>',
      errors: [],
    });
  });

  it("picks them out of the props object in the object form", async () => {
    const Tag = await load([
      "Tag.uf.tsx",
      `export default function Tag(props: { label: string; tone?: string }) {
  return <span class="tag">{props.label}</span>;
}`,
    ]);
    expect(render(Tag, { label: "New", tone: "info", "data-uf-0a1b2c3d": "" })).toEqual({
      html: '<span class="tag" data-uf-0a1b2c3d="">New</span>',
      errors: [],
    });
  });

  it("puts them on each branch of a root conditional, and on a root <component is>", async () => {
    const Status = await load([
      "Status.uf.tsx",
      `export default function Status({ busy }: { busy: boolean }) {
  return <>{busy ? <span class="badge">Saving</span> : <button type="button">Save</button>}</>;
}`,
    ]);
    const Heading = await load([
      "Heading.uf.tsx",
      `export default function Heading({ big }: { big: boolean }) {
  return <component is={big ? "h2" : "h3"} class="heading">Notes</component>;
}`,
    ]);
    const scope = { "data-uf-0a1b2c3d": "" };
    expect(
      [
        render(Status, { busy: true, ...scope }),
        render(Status, { busy: false, ...scope }),
        render(Heading, { big: false, ...scope }),
      ].map(({ html, errors }) => ({ html, errors })),
    ).toEqual([
      { html: '<span class="badge" data-uf-0a1b2c3d="">Saving</span>', errors: [] },
      { html: '<button type="button" data-uf-0a1b2c3d="">Save</button>', errors: [] },
      { html: '<h3 class="heading" data-uf-0a1b2c3d="">Notes</h3>', errors: [] },
    ]);
  });

  it("passes them on through a root component to its element", async () => {
    const Save = await load(
      ["Button.uf.tsx", BUTTON],
      [
        "Save.uf.tsx",
        `import Button from "./Button.uf.tsx";
export default function Save() {
  return <Button text="Save" />;
}`,
      ],
    );
    expect(render(Save, { "data-uf-0a1b2c3d": "" })).toEqual({
      html: '<button type="button" class="button" data-uf-0a1b2c3d="">Save</button>',
      errors: [],
    });
  });
});
