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
      "element",
      "interactivity",
      "listbox",
      "static-attribute",
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

  it("imports Angular's decorator under another name when the component is named after it", () => {
    const [file] = emitModule(moduleOf(greeting, "Component"));
    expect(file!.contents).toMatch(
      /^import \{ Component as Component_1 \} from "@angular\/core";\n\n@Component_1\(\{/,
    );
    expect(file!.contents).toMatch(/\nexport default class Component \{\}\n$/);
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
