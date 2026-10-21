// Scoped styles on Solid (ADR-0063): the sheet's import, the child-root rule through the inline
// `scopeAttributes` helper, and a slotted child's `-s` on the content a parent fills in, children
// and render functions alike. Each source is lowered as `compile()` lowers it, with the sheets and
// the child APIs its resolver would read, and the child-root rule is rendered by Solid's server.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { transformSync } from "@babel/core";
import { formatOutput } from "@unframework/codegen";
import type { ModuleApi, UfModule } from "@unframework/ir";
import type { Component } from "solid-js";
import { createComponent, renderToStringAsync } from "solid-js/web";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { analyze } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";
import { packageDir } from "./fixtures.ts";

const require = createRequire(import.meta.url);

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

/** The formatted Solid output of a module's component, its first by default. */
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

describe("solid scoped styles", () => {
  const list = lowered("List.uf.tsx", LIST, {
    "./List.css": ":slotted(.item) { color: green; }\n",
  });
  const ranking = lowered(
    "Ranking.uf.tsx",
    RANKING,
    { "./Ranking.css": ".item { margin: 0; }\n" },
    { "./List.uf.tsx": { ...list.api, file: "List.uf.tsx" } },
  );
  const listId = list.module.components[0]!.scopeId!;
  const rankingId = ranking.module.components[0]!.scopeId!;

  it("imports a styled component's sheet after its other imports", async () => {
    const code = await output(ranking.module);
    expect(code.split("\n\n")[0]).toBe(
      [
        'import List from "./List";',
        'import type { JSX } from "solid-js";',
        'import "./Ranking.uf.tsx.css";',
      ].join("\n"),
    );
  });

  it("stamps the child's `-s` on the children and on a render function's content", async () => {
    const code = await output(ranking.module);
    const stamped = `class="item" data-uf-${rankingId}="" data-uf-${listId}-s=""`;
    // The child's tag takes the parent's attribute (the child-root rule), not the child's `-s`.
    expect(code).toContain(`<List\n      names={props.names}\n      data-uf-${rankingId}=""\n`);
    expect(code).toContain(`<h2 ${stamped}>`);
    expect(code).toContain(`<b ${stamped}>`);
  });

  it("spreads the scope attributes its styled parents pass on the root of a styled child too", async () => {
    const code = await output(list.module);
    expect(code).toContain(
      `data-uf-${listId}=""\n      style={props.style}\n      {...scopeAttributes(props)}\n    >`,
    );
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

describe("solid child-root rule, rendered by Solid's server", () => {
  let scratch: string;
  beforeAll(() => {
    mkdirSync(join(packageDir, ".uf-tmp"), { recursive: true });
    // In the package, so the output's `solid-js` imports resolve from its node_modules.
    scratch = mkdtempSync(join(packageDir, ".uf-tmp", "styles-"));
  });
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  /** Compiles each source's output for the server beside the others, and loads the last one's. */
  async function load(...sources: [file: string, source: string][]) {
    let path = "";
    const apis: Record<string, ModuleApi> = {};
    for (const [file, source] of sources) {
      const { module, api } = lowered(file, source, {}, apis);
      apis[`./${file}`] = { ...api, file };
      const name = module.components[0]!.name;
      const { code } = transformSync(await output(module), {
        filename: join(scratch, `${name}.tsx`),
        babelrc: false,
        configFile: false,
        presets: [
          [require.resolve("babel-preset-solid"), { generate: "ssr", hydratable: true }],
          [require.resolve("@babel/preset-typescript"), { isTSX: true, allExtensions: true }],
        ],
      })!;
      path = join(scratch, `${name}.js`);
      writeFileSync(path, code!.replace(/from "\.\/(\w+)"/g, 'from "./$1.js"'));
    }
    return ((await import(path)) as { default: Component<Record<string, unknown>> }).default;
  }

  /** The server's HTML for a component and its props, without hydration keys and markers. */
  async function render(
    component: Component<Record<string, unknown>>,
    props: Record<string, unknown>,
  ) {
    const html = await renderToStringAsync(() => createComponent(component, props));
    return html.replace(/<!--[^>]*-->/g, "").replace(/ data-hk="[^"]*"/g, "");
  }

  const BUTTON = `export default function Button({ text, note }: { text: string; note?: string }) {
  return <button type="button" class="button">{text}</button>;
}`;

  // A root that spreads its scope attributes renders through Solid's `ssrElement`, which writes a
  // space after a class and `style` for a key that holds nothing (ADR-0063).
  it("puts the parents' scope attributes on its root, and no prop it leaves unread", async () => {
    const Button = await load(["Button.uf.tsx", BUTTON]);
    expect(
      await render(Button, {
        text: "Save",
        note: "unread",
        "data-uf-0a1b2c3d": "",
        "data-uf-1a2b3c4d": "",
      }),
    ).toBe(
      '<button type="button" class="button " style="" data-uf-0a1b2c3d="" data-uf-1a2b3c4d="">Save</button>',
    );
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
    expect([
      await render(Status, { busy: true, ...scope }),
      await render(Status, { busy: false, ...scope }),
      await render(Heading, { big: false, ...scope }),
    ]).toEqual([
      '<span class="badge " data-uf-0a1b2c3d="">Saving</span>',
      '<button type="button" data-uf-0a1b2c3d="">Save</button>',
      // `<Dynamic>` passes its `component` key to `ssrElement`, which skips it after a space.
      '<h3 class="heading " data-uf-0a1b2c3d="" >Notes</h3>',
    ]);
  });

  // `ssrElement` writes a spread element's JSX text decoded, so the root's text that holds a
  // character HTML reads there prints as a string literal, which the compiler escapes.
  it("escapes the root's text on the server", async () => {
    const Sum = await load([
      "Sum.uf.tsx",
      `export default function Sum() { return <p>a &lt; b &amp;&amp; c &gt; d</p>; }`,
    ]);
    const Title = await load([
      "Title.uf.tsx",
      `export default function Title({ big }: { big: boolean }) {
  return <component is={big ? "h2" : "h3"}>a &lt; b</component>;
}`,
    ]);
    expect([await render(Sum, {}), await render(Title, { big: true })]).toEqual([
      '<p class="" style="">a &lt; b &amp;&amp; c > d</p>',
      "<h2 >a &lt; b</h2>",
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
    expect(await render(Save, { "data-uf-0a1b2c3d": "" })).toBe(
      '<button type="button" class="button " style="" data-uf-0a1b2c3d="">Save</button>',
    );
  });
});
