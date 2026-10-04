import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  createComponent,
  createElement,
  createExport,
  createModule,
  createStaticAttribute,
  createText,
} from "@unframework/ir";
import type { ElementNode, UfModule } from "@unframework/ir";
import { afterAll, describe, expect, it } from "vitest";

import target from "../src/index.ts";
import { createHost, strictOptions } from "../src/toolchain/ngtsc.ts";
import { loadCompiler } from "../src/toolchain/tools.ts";
import {
  context,
  corpus,
  emitFormatted,
  emitModule,
  emitted,
  formatted,
  removeScratch,
  scratchDir,
} from "./helpers.ts";

afterAll(removeScratch);

const at = { start: 0, end: 0 };
const text = (value: string) => createText(value, at);
const element = (tag: string, children: ElementNode["children"] = []) =>
  createElement(tag, [], children, at);

function moduleOf(
  render: ElementNode,
  name = "Hello",
  kind: "default" | "named" = "default",
): UfModule {
  const component = createComponent(name, render, at);
  return createModule(`${name}.uf.tsx`, [component], [createExport(kind, name, at)]);
}

/**
 * The JavaScript ngtsc compiles a component file to, under a consumer's own compiler options
 * (`angularCompilerOptions`), as a program that includes the file would.
 */
async function compiled(contents: string, consumer: Record<string, unknown>): Promise<string> {
  const compiler = await loadCompiler(context.toolchainDir);
  const options = { ...strictOptions(compiler), noEmit: false, declaration: false, ...consumer };
  const file = join(scratchDir(), "component.ts");
  const host = createHost(compiler, options, (name) =>
    resolve(name) === file ? contents : undefined,
  );
  const program = new compiler.cli.NgtscProgram([file], options, host);
  await program.compiler.analyzeAsync();
  const { transformers } = program.compiler.prepareEmit();
  const tsProgram = program.getTsProgram();
  let code = "";
  tsProgram.emit(
    tsProgram.getSourceFile(file),
    (name, output) => {
      if (name.endsWith(".js")) code = output;
    },
    undefined,
    false,
    transformers,
  );
  return code;
}

/** The template literal's contents of an emitted file, as written: backslashes doubled. */
function templateOf(contents: string): string {
  return /template: `([\s\S]*)`\n/.exec(contents)![1]!;
}

const greeting = createElement(
  "p",
  [createStaticAttribute("class", "greeting", at)],
  [text("Hello, world!")],
  at,
);

describe("angular target", () => {
  it("declares every capability", () => {
    expect(Object.keys(target.capabilities).toSorted()).toEqual([
      "attribute-spread",
      "bound-attribute",
      "class-binding",
      "conditional",
      "element",
      "fragment",
      "interactivity",
      "interpolation",
      "list",
      "listbox",
      "props",
      "static-attribute",
      "style-binding",
      "svg",
      "text",
    ]);
  });

  it("emits a standalone component whose decorator precedes `export default class`", () => {
    expect(emitModule(moduleOf(greeting))).toEqual([
      {
        path: "hello.ts",
        contents: [
          'import { Component } from "@angular/core";',
          "",
          "@Component({",
          '  selector: "uf-hello",',
          '  host: { style: "display: contents" },',
          "  preserveWhitespaces: false,",
          "  template: `",
          '    <p class="greeting">Hello, world!</p>',
          "  `",
          "})",
          "export default class Hello {}",
          "",
        ].join("\n"),
      },
    ]);
  });

  it("exports a named component by name", () => {
    const [file] = emitModule(moduleOf(greeting, "Hello", "named"));
    expect(file!.contents).toMatch(/\}\)\nexport class Hello \{\}\n$/);
  });

  it("names the file and the selector after the component, in kebab case", () => {
    const [file] = emitModule(moduleOf(greeting, "ProfileCard"));
    expect(file!.path).toBe("profile-card.ts");
    expect(file!.contents).toContain('selector: "uf-profile-card"');
  });

  // Angular 22 defaults to standalone components and OnPush change detection.
  it("leaves the Angular 22 defaults out of the metadata", () => {
    const [file] = emitModule(moduleOf(greeting));
    expect(file!.contents).not.toMatch(/standalone|changeDetection/);
  });

  it("escapes Angular's template syntax and the template literal's", () => {
    const [file] = emitModule(moduleOf(element("p", [text("@if (b) {} <c> & `${d}` \\e")])));
    expect(templateOf(file!.contents)).toBe(
      "\n    <p>&#64;if (b) &#123;&#125; &lt;c> &amp; \\`$&#123;d&#125;\\` \\\\e</p>\n  ",
    );
  });

  // Angular decodes `&#123;&#123;` before it looks for interpolations.
  it("prints a run of opening braces through a string interpolation", () => {
    const [file] = emitModule(moduleOf(element("p", [text("{{ a }} {b} {{{")])));
    expect(templateOf(file!.contents)).toContain(
      String.raw`<p>{{ "\\u007b\\u007b" }} a &#125;&#125; &#123;b&#125; {{ "\\u007b\\u007b\\u007b" }}</p>`,
    );
  });

  // Angular finds `{{` in an attribute after decoding its entities, and would evaluate it; a
  // binding instead would go through its sanitizer (test/render-parity.test.ts renders both).
  it("writes an element whose attribute holds `{{` where Angular binds nothing", () => {
    const render = createElement(
      "p",
      [createStaticAttribute("title", "{{ 1 + 1 }}", at), createStaticAttribute("id", "{x}", at)],
      [],
      at,
    );
    const [file] = emitModule(moduleOf(render));
    expect(templateOf(file!.contents)).toBe(
      [
        "",
        "    <ng-container ngNonBindable ngPreserveWhitespaces><p",
        '      title="&#123;&#123; 1 + 1 &#125;&#125;"',
        '      id="&#123;x&#125;"',
        "    ></p></ng-container>",
        "  ",
      ].join("\n"),
    );
  });

  // The template is a JS template literal, which would turn a raw CR into a line feed.
  it("writes a carriage return in an attribute as a reference", () => {
    const render = createElement("p", [createStaticAttribute("title", "a\rb", at)], [], at);
    const [file] = emitModule(moduleOf(render));
    expect(templateOf(file!.contents)).toContain('<p title="a&#13;b"></p>');
  });

  // Angular's compiler accepts a signal input only in a class whose decorator it imports as
  // `Component` (NG8110 otherwise), so the class takes another name; the export keeps its own.
  it("names the class apart when the component is named after Angular's decorator", () => {
    const [file] = emitModule(moduleOf(greeting, "Component"));
    expect(file!.contents).toMatch(
      /^import \{ Component \} from "@angular\/core";\n\n@Component\(\{/,
    );
    expect(file!.contents).toMatch(/\nexport default class Component_1 \{\}\n$/);
    const [named] = emitModule(moduleOf(greeting, "Component", "named"));
    expect(named!.contents).toMatch(
      /\nclass Component_1 \{\}\nexport \{ Component_1 as Component \};\n$/,
    );
  });

  // Angular drops every whitespace-only text node, even one the browser renders as a space.
  it("keeps a space between inline elements with &ngsp;", () => {
    const render = element("p", [element("b", [text("a")]), text(" "), element("i", [text("b")])]);
    const [file] = emitModule(moduleOf(render));
    expect(templateOf(file!.contents)).toContain("<b>a</b>&ngsp;<i>b</i>");
  });

  it("keeps whitespace as written inside <pre>", () => {
    const render = element("div", [
      element("pre", [element("b", [text("a")]), text(" "), element("i", [text("b")])]),
    ]);
    const [file] = emitModule(moduleOf(render));
    expect(templateOf(file!.contents)).toContain("<pre><b>a</b> <i>b</i></pre>");
  });

  // The template's layout is printed for Angular's default, `preserveWhitespaces: false`. A
  // program that compiles the component with its own `preserveWhitespaces: true` (a consumer's
  // `angularCompilerOptions`) would turn the indentation into text: the metadata pins it.
  it("keeps the template's layout out of the DOM whatever the consumer's whitespace option", async () => {
    const list = element("ul", [element("li", [text("a")]), element("li", [text("b")])]);
    const [file] = emitModule(moduleOf(list, "List"));
    expect(file!.contents).toContain("  preserveWhitespaces: false,\n");
    const whitespace = /ɵɵtext\(\d+, "(?:\\n| )+"\)/;
    const unpinned = file!.contents.replace("  preserveWhitespaces: false,\n", "");
    expect(await compiled(unpinned, { preserveWhitespaces: true })).toMatch(whitespace);
    expect(await compiled(file!.contents, { preserveWhitespaces: true })).not.toMatch(whitespace);
  });

  it("leaves text with content alone", () => {
    const render = element("p", [text("a "), element("b", [text("b")]), text(" c")]);
    const [file] = emitModule(moduleOf(render));
    expect(templateOf(file!.contents)).toContain("<p>a <b>b</b> c</p>");
  });

  // The compile project owns the goldens; this pins that the emitter (formatted as the compiler
  // formats it) still writes exactly them.
  it("emits the corpus's committed golden outputs", async () => {
    const cases = corpus();
    expect(cases.length).toBeGreaterThan(0);
    for (const { name, module, outputDir } of cases) {
      for (const file of await emitFormatted(module)) {
        expect(file.contents, name).toBe(readFileSync(join(outputDir, file.path), "utf8"));
      }
    }
  });
});

/** The class's body of an emitted file, one member per line, as the compiler formats it. */
function classBody(contents: string): string[] {
  const body = /\n(?:export (?:default )?)?class \w+ \{\n([\s\S]*?)\n\}\n/.exec(contents);
  return body ? body[1]!.split("\n").map((line) => line.trim()) : [];
}

/** The lines of an emitted file's template, without their indentation, formatted or not. */
function templateLines(contents: string): string[] {
  return /template: `([\s\S]*)`,?\n/
    .exec(contents)![1]!
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

describe("props (design §5.5)", () => {
  it("emits a component whose props are signal inputs, read through `@let`", async () => {
    const file = await formatted(`
export interface BadgeProps {
  label: string;
  tone?: "info" | "warn";
  count?: number;
}

export default function Badge({ label, tone = "info", count }: BadgeProps) {
  return <p data-tone={tone}>{label} {count ?? 0}</p>;
}
`);
    expect(file).toEqual({
      path: "badge.ts",
      contents: [
        'import { Component, input } from "@angular/core";',
        "",
        "export interface BadgeProps {",
        "  label: string;",
        '  tone?: "info" | "warn";',
        "  count?: number;",
        "}",
        "",
        "@Component({",
        '  selector: "uf-badge",',
        '  host: { style: "display: contents" },',
        "  preserveWhitespaces: false,",
        "  template: `",
        "    @let label = this.label();",
        "    @let tone = this.tone();",
        "    @let count = this.count();",
        '    <p [attr.data-tone]="tone">{{ label }}&ngsp;{{ count ?? 0 }}</p>',
        "  `,",
        "})",
        "export default class Badge {",
        "  readonly label = input.required<string>();",
        '  readonly tone = input<"info" | "warn", "info" | "warn" | undefined>("info", {',
        '    transform: (value) => (value === undefined ? "info" : value),',
        "  });",
        "  readonly count = input<number>();",
        "}",
        "",
      ].join("\n"),
    });
  });

  // Angular's initial value covers an absent input only: `setInput(name, undefined)` sets
  // `undefined`, where JavaScript's destructuring takes the default. `null` stays a value.
  it("gives every default a transform that maps `undefined`, and only it, to the default", async () => {
    const file = await formatted(`
export interface DefaultsProps {
  label?: string | null;
  size?: number;
  tags?: readonly string[];
  author?: { name: string };
}

export default function Defaults({ label = null, size = 1000, tags = [], author = { name: "Ada" } }: DefaultsProps) {
  return <p data-size={size}>{label} {tags.join(", ")} {author.name}</p>;
}
`);
    expect(classBody(file.contents)).toEqual([
      "readonly label = input<string | null, string | null | undefined>(null, {",
      "transform: (value) => (value === undefined ? null : value),",
      "});",
      "readonly size = input<number, number | undefined>(1000, {",
      "transform: (value) => (value === undefined ? 1000 : value),",
      "});",
      "readonly tags = input<readonly string[], readonly string[] | undefined>([], {",
      "transform: (value) => (value === undefined ? [] : value),",
      "});",
      "readonly author = input<{ name: string }, { name: string } | undefined>(",
      '{ name: "Ada" },',
      '{ transform: (value) => (value === undefined ? { name: "Ada" } : value) },',
      ");",
    ]);
  });

  // The transform never returns `undefined`, so the input's value type leaves it out: the
  // template reads the prop as the source does, where the default removed it.
  it("types an input with a default without `undefined`", async () => {
    const file = await formatted(`
type Tone = "info" | "warn" | undefined;

export interface ToneProps {
  tone?: Tone;
  size?: number | undefined;
}

export default function ToneLabel({ tone = "info", size = 1 }: ToneProps) {
  return <p data-size={size}>{tone.toUpperCase()}</p>;
}
`);
    expect(classBody(file.contents)).toEqual([
      'readonly tone = input<Exclude<Tone, undefined>, Exclude<Tone, undefined> | undefined>("info", {',
      'transform: (value) => (value === undefined ? "info" : value),',
      "});",
      "readonly size = input<number, number | undefined>(1, {",
      "transform: (value) => (value === undefined ? 1 : value),",
      "});",
    ]);
  });

  it("reads the `props` form through the same variables", async () => {
    const file = await formatted(`
export default function Byline(props: { author: string; minutes?: number }) {
  return <p>By {props.author}, {props.minutes ?? 1} min</p>;
}
`);
    expect(templateLines(file.contents)).toEqual([
      "@let author = this.author();",
      "@let minutes = this.minutes();",
      "<p>By {{ author }}, {{ minutes ?? 1 }} min</p>",
    ]);
    expect(classBody(file.contents)).toEqual([
      "readonly author = input.required<string>();",
      "readonly minutes = input<number>();",
    ]);
    // An inline props type declares nothing.
    expect(file.contents).not.toMatch(/interface|type /);
  });

  // A prop is the component's API: a consumer may pass one the template does not read, which
  // Angular would report for an undeclared input (NG0303). An unread `@let` is NG8112.
  it("declares an input for every prop, and a variable only for those the template reads", async () => {
    const file = await formatted(`
export interface QuietProps {
  label: string;
  hidden?: boolean;
  note?: string;
}

export default function Quiet({ label, note }: QuietProps) {
  return <p>{label}</p>;
}
`);
    expect(templateLines(file.contents)).toEqual(["@let label = this.label();", "<p>{{ label }}</p>"]);
    expect(classBody(file.contents)).toEqual([
      "readonly label = input.required<string>();",
      "readonly hidden = input<boolean>();",
      "readonly note = input<string>();",
    ]);
  });

  // An input is typed by its member's type, never by the props type: a props interface the
  // source does not export would be declared and unused (oxlint's no-unused-vars, L5).
  it("declares the exported types and the ones an input reaches, in source order", async () => {
    const file = await formatted(`
type Size = "s" | "m";

interface Unused {
  a: string;
}

interface Finish {
  size: Size;
}

interface PanelProps {
  finishes: Finish[];
  extra: Extra;
}

export interface Extra {
  unused: Unused;
}

export default function Panel({ finishes, extra }: PanelProps) {
  return <p>{finishes.length} {extra.unused.a}</p>;
}
`);
    const declared = [...file.contents.matchAll(/^(?:export )?(?:interface|type) (\w+)/gm)];
    expect(declared.map((match) => match[1])).toEqual(["Size", "Unused", "Finish", "Extra"]);
  });

  it("imports `input` only when there are props, under another name when the module declares it", async () => {
    const plain = await formatted(`export default function Plain() { return <p>{Math.PI}</p>; }`);
    expect(plain.contents).toMatch(/^import \{ Component \} from "@angular\/core";\n/);
    const taken = await formatted(`
export interface input {
  value: string;
}

export default function Field({ value }: input) {
  return <p>{value}</p>;
}
`);
    expect(taken.contents).toMatch(/^import \{ Component, input as input_1 \} from "@angular\/core";/);
    expect(classBody(taken.contents)).toEqual(["readonly value = input_1.required<string>();"]);
  });
});

describe("template (design §5.5)", () => {
  // Angular narrows a template variable as TypeScript narrows a local, never a signal call
  // (TS2532 on \`owner() && owner().name\`): output.test.ts proves this source type-checks.
  it("writes the source's expressions as written, against the variables", async () => {
    const file = await formatted(`
interface Owner {
  name: string;
}

export interface CardProps {
  owner?: Owner;
}

export default function Card({ owner }: CardProps) {
  return <div>{owner && <p>{owner.name.toUpperCase()}</p>}</div>;
}
`);
    expect(templateLines(file.contents)).toEqual([
      "@let owner = this.owner();",
      "<div>",
      "@if (owner) {",
      "<p>{{ owner.name.toUpperCase() }}</p>",
      "}",
      "</div>",
    ]);
  });

  // A \`track\` expression reads only its own item, \`$index\` and the component's members (NG8009).
  it("reads a prop in a list's key from its input, and declares the index the key reads", async () => {
    const file = await formatted(`
export interface RowsProps {
  prefix: string;
  rows: { id: string; label: string }[];
}

export default function Rows({ prefix, rows }: RowsProps) {
  return (
    <ul>
      {rows.map((row) => <li key={prefix + row.id}>{row.label}</li>)}
      {rows.map((row, index) => <li key={index}>{row.label}</li>)}
      {rows.map((row, index) => <li key={row.id}>{row.label}</li>)}
    </ul>
  );
}
`);
    expect(templateLines(file.contents)).toEqual([
      "@let rows = this.rows();",
      "<ul>",
      "@for (row of rows; track this.prefix() + row.id) {",
      "<li>{{ row.label }}</li>",
      "}",
      "@for (row of rows; track index; let index = $index) {",
      "<li>{{ row.label }}</li>",
      "}",
      "@for (row of rows; track row.id) {",
      "<li>{{ row.label }}</li>",
      "}",
      "</ul>",
    ]);
  });

  it("makes each allowed global the template reads a protected member", async () => {
    const file = await formatted(`
export interface StatsProps {
  values: number[];
}

export default function Stats({ values }: StatsProps) {
  return <p title={JSON.stringify(values)}>{Math.max(...values)} {String(undefined)} {NaN}</p>;
}
`);
    expect(classBody(file.contents)).toEqual([
      "readonly values = input.required<number[]>();",
      "protected readonly JSON = JSON;",
      "protected readonly Math = Math;",
      "protected readonly NaN = NaN;",
      "protected readonly String = String;",
    ]);
  });

  // An interface without members declares no key, so the spread prints nothing (ADR-0039).
  it("declares no variable for a spread that prints nothing", async () => {
    const file = await formatted(`
interface Nothing {}

export interface EmptyProps {
  attrs: Nothing;
}

export default function Empty({ attrs }: EmptyProps) {
  return <p {...attrs}>x</p>;
}
`);
    expect(templateLines(file.contents)).toEqual(["<p>x</p>"]);
  });

  it("prints valid TypeScript before formatting too", () => {
    const contents = emitted(`
export interface BadgeProps {
  tone?: "info" | "warn";
}

export default function Badge({ tone = "info" }: BadgeProps) {
  return <p>{tone}</p>;
}
`);
    expect(classBody(contents)).toEqual([
      'readonly tone = input<"info" | "warn", "info" | "warn" | undefined>("info", { transform: (value) => value === undefined ? "info" : value });',
    ]);
  });
});
