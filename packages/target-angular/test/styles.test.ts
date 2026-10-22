// Scoped styles on Angular (ADR-0063): the sheet's `styleUrl` without Angular's own
// encapsulation, the child-root rule through the `[ufScope]` directive each root node binds, and
// the names a source's components claim apart. Each source is lowered as `compile()` lowers it,
// with the sheets and the child APIs its resolver would read, and the child-root rule is rendered
// by Angular's server platform.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { scopeStylesheet } from "@unframework/codegen";
import type { ModuleApi, UfModule } from "@unframework/ir";
import { afterAll, describe, expect, it } from "vitest";

import { analyze } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { emitFormatted, ngtscPlugin, removeScratch, scratchDir } from "./helpers.ts";

afterAll(removeScratch);

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

/** The formatted Angular output of a module's component, its first by default. */
async function output(module: UfModule, index = 0): Promise<string> {
  return (await emitFormatted(module))[index]!.contents;
}

const BUTTON = `export default function Button({ text }: { text: string }) {
  return <button type="button" class="button">{text}</button>;
}`;

describe("angular scoped styles", () => {
  it("attaches a styled component's sheet by `styleUrl`, without Angular's encapsulation", async () => {
    const { module } = lowered(
      "Card.uf.tsx",
      `import "./Card.css";
export default function Card() {
  return <p class="label">Hi</p>;
}`,
      { "./Card.css": ".label { color: red; }\n" },
    );
    const code = await output(module);
    expect(code).toContain(
      '  styleUrl: "./Card.uf.tsx.css",\n  encapsulation: ViewEncapsulation.None,\n})',
    );
    expect(code).toMatch(/^import \{[^}]*\bViewEncapsulation\b[^}]*\} from "@angular\/core";/m);
    const plain = await output(lowered("Button.uf.tsx", BUTTON).module);
    expect(plain).not.toMatch(/styleUrl|encapsulation/);
  });

  it("binds the scope directive on each root node, and on nothing else", async () => {
    const binds = (code: string) => code.match(/\[ufScope\]="this\.host"/g)?.length ?? 0;
    const button = await output(lowered("Button.uf.tsx", BUTTON).module);
    expect(button).toContain('[ufScope]="this.host"\n    >{{ text }}</button>');
    expect(button).toContain("imports: [ScopeAttributes],");
    expect(button).toContain(
      "protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;",
    );
    expect(binds(button)).toBe(1);
    const status = await output(
      lowered(
        "Status.uf.tsx",
        `export default function Status({ busy }: { busy: boolean }) {
  return <>{busy ? <span class="badge"><b>Saving</b></span> : <button type="button">Save</button>}</>;
}`,
      ).module,
    );
    expect(binds(status)).toBe(2);
    const heading = await output(
      lowered(
        "Heading.uf.tsx",
        `export default function Heading({ big }: { big: boolean }) {
  return <component is={big ? "h2" : "h3"} class="heading">Notes</component>;
}`,
      ).module,
    );
    expect(binds(heading)).toBe(2);
    // Several nodes are a fragment to Vue, which gives none of them the attributes.
    const pair = await output(
      lowered(
        "Pair.uf.tsx",
        `export default function Pair() {
  return <><b>A</b><i>B</i></>;
}`,
      ).module,
    );
    expect(pair).not.toMatch(/ufScope|ScopeAttributes|host =/);
  });

  // The unplugin joins a source's outputs into one module (ADR-0053): each component's
  // directive, map and export take names no other component declares.
  it("names the scope directive and its map of each component of a source apart", async () => {
    const { module } = lowered(
      "Two.uf.tsx",
      `export function Item({ scopes }: { scopes: string }) {
  return <li>{scopes}</li>;
}
export default function Two() {
  return <ul><Item scopes="a" /></ul>;
}`,
    );
    const declared = async (index: number) =>
      [...(await output(module, index)).matchAll(/^(?:export class|const) (\w+)\b/gm)]
        .map((match) => match[1]!)
        .filter((name) => /^(?:ScopeAttributes|scopes)(?:_\d+)*$/.test(name));
    const [first, second] = [await declared(0), await declared(1)];
    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
    expect(new Set([...first, ...second]).size).toBe(4);
  });
});

describe("angular child-root rule, rendered by Angular", () => {
  /**
   * Compiles each source's output with the ngtsc plugin, as the browser and SSR projects do,
   * writes them beside each other and loads the last one's component. A child's output is
   * imported by its kebab-case name (`./button`).
   */
  async function load(...sources: [file: string, source: string, sheet?: string][]) {
    const directory = scratchDir();
    const apis: Record<string, ModuleApi> = {};
    const outputs = new Map<string, { name: string; code: string }>();
    const sheets: Record<string, string> = {};
    for (const [file, source, sheet] of sources) {
      const css = file.replace(/\.uf\.tsx$/, ".css");
      const { module, api } = lowered(file, source, sheet ? { [`./${css}`]: sheet } : {}, apis);
      apis[`./${file}`] = { ...api, file };
      const [code] = await emitFormatted(module);
      // The sheet `compile()` scopes and emits beside the outputs.
      const { scopeId } = module.components[0]!;
      if (sheet) sheets[join(directory, file)] = scopeStylesheet(css, sheet, scopeId!).code;
      const name = code!.path.replace(/\.ts$/, "");
      outputs.set(join(directory, `${file}.ts`), { name, code: code!.contents });
    }
    const byName = new Map([...outputs].map(([id, { name }]) => [`./${name}`, id]));
    const { transform } = await ngtscPlugin(
      Object.fromEntries([...outputs].map(([id, { code }]) => [id, code])),
      "server",
      { resolve: (specifier) => byName.get(specifier), sheets },
    );
    let last = "";
    for (const [id, { name }] of outputs) {
      const { code } = await transform(id);
      last = join(directory, `${name}.js`);
      writeFileSync(last, code.replace(/from "\.\/([\w-]+)"/g, 'from "./$1.js"'));
    }
    return ((await import(pathToFileURL(last).href)) as { default: unknown }).default;
  }

  it("moves the parents' scope attributes from the host to the root", async () => {
    const Toolbar = await load(
      ["Button.uf.tsx", BUTTON],
      [
        "Toolbar.uf.tsx",
        `import "./Toolbar.css";
import Button from "./Button.uf.tsx";
export default function Toolbar() {
  return <div class="toolbar"><Button text="Save" /></div>;
}`,
        ".button { color: red; }\n",
      ],
    );
    const html = await renderToString(Toolbar, {});
    const id = /data-uf-([0-9a-f]{8})/.exec(html)![1]!;
    expect(html).toContain(
      `<uf-button style="display: contents;"><button type="button" class="button" data-uf-${id}="">Save</button></uf-button>`,
    );
  });

  it("passes them on through a root component to its element", async () => {
    const Toolbar = await load(
      ["Button.uf.tsx", BUTTON],
      [
        "Save.uf.tsx",
        `import Button from "./Button.uf.tsx";
export default function Save() {
  return <Button text="Save" />;
}`,
      ],
      [
        "Toolbar.uf.tsx",
        `import "./Toolbar.css";
import Save from "./Save.uf.tsx";
export default function Toolbar() {
  return <div class="toolbar"><Save /></div>;
}`,
        ".button { color: red; }\n",
      ],
    );
    const html = await renderToString(Toolbar, {});
    const id = /data-uf-([0-9a-f]{8})/.exec(html)![1]!;
    expect(html).toContain(
      `<uf-save style="display: contents;"><uf-button style="display: contents;"><button type="button" class="button" data-uf-${id}="">Save</button></uf-button></uf-save>`,
    );
  });
});
