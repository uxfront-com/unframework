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

/** The formatted Solid output of a module's first component. */
async function output(module: UfModule): Promise<string> {
  const reported: unknown[] = [];
  const [file] = target.emit(module.components[0]!, {
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
    expect(code).toContain(`<h2 ${stamped}>`);
    expect(code).toContain(`<b ${stamped}>`);
  });

  it("spreads the scope attributes its styled parents pass on the root of a styled child too", async () => {
    const code = await output(list.module);
    expect(code).toContain(
      `data-uf-${listId}=""\n      style={props.style}\n      {...scopeAttributes(props)}\n    >`,
    );
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
