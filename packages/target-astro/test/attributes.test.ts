// The attributes Astro's JSX types declare (L4): every (element, attribute) pair the IR's
// vocabulary accepts, bound and (for booleans) bare, through `astro check`. Printed with the bare
// Astro dialect, exactly the pairs `isUntypedAttribute` names fail, as a missing declaration;
// printed as the target prints them, none does. So the target's list is neither short nor long.
// Values are typed `never` here: whether a value's type fits an attribute is the analyser's
// question (design §1.5), not a declaration's.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { astroDialect, printMarkup } from "@unframework/codegen";
import type { MarkupDialect } from "@unframework/codegen";
import {
  ARIA_ATTRIBUTES,
  BOOLEAN_ATTRIBUTES,
  createBoundAttribute,
  createComponent,
  createElement,
  createExpression,
  createFragment,
  createStaticAttribute,
  ELEMENT_ATTRIBUTES,
  GLOBAL_ATTRIBUTES,
  HTML_ELEMENTS,
  span,
  SVG_ELEMENT_ATTRIBUTES,
  SVG_ELEMENTS,
  SVG_GLOBAL_ATTRIBUTES,
  SVG_PRESENTATION_ATTRIBUTES,
  UNRENDERABLE_ELEMENTS,
} from "@unframework/ir";
import type { Attribute, ElementNode } from "@unframework/ir";
import { afterAll, describe, expect, it } from "vitest";

import { isUntypedAttribute, printComponentMarkup } from "../src/markup.ts";
import { astroTypecheck } from "../src/toolchain/check.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { loadAstroComponent, scratchDirectory } from "./astro.ts";
import { emitted } from "./source.ts";
import { integrationRoot, toolchainDir } from "./workspace.ts";

const scratch = scratchDirectory("attributes");
afterAll(() => scratch.remove());

const at = span(0, 0);

/** Attributes another rule owns: class and style have their own forms, and `slot`/`is` are UF3005. */
const OWN_FORMS = new Set(["class", "style", "slot", "is"]);

/** Elements written at the top level of a component's markup that HTML would move or drop. */
const UNPLACEABLE = new Set(["html", "head", "body", "title", "base", "link", "meta", "noscript"]);

/** One element per (element, attribute) pair: bound to `x`, and bare when it is a boolean. */
function vocabulary(): ElementNode[] {
  const elements: ElementNode[] = [];
  const add = (tag: string, attribute: Attribute) =>
    elements.push(createElement(tag, [attribute], [], at));
  const bound = (name: string) => createBoundAttribute(name, createExpression("x", at), at);
  for (const tag of [...HTML_ELEMENTS].toSorted()) {
    if (UNRENDERABLE_ELEMENTS.has(tag) || UNPLACEABLE.has(tag)) continue;
    const names = [...GLOBAL_ATTRIBUTES, ...(ELEMENT_ATTRIBUTES.get(tag) ?? []), ...ARIA_ATTRIBUTES];
    for (const name of names.toSorted()) {
      if (OWN_FORMS.has(name)) continue;
      add(tag, bound(name));
      if (BOOLEAN_ATTRIBUTES.has(name)) add(tag, createStaticAttribute(name, true, at));
    }
  }
  for (const tag of [...SVG_ELEMENTS].toSorted()) {
    const names = [
      ...SVG_GLOBAL_ATTRIBUTES,
      ...SVG_PRESENTATION_ATTRIBUTES,
      ...(SVG_ELEMENT_ATTRIBUTES.get(tag) ?? []),
      ...ARIA_ATTRIBUTES,
    ];
    for (const name of names.toSorted()) {
      if (OWN_FORMS.has(name)) continue;
      const attribute = bound(name);
      elements.push(
        tag === "svg"
          ? createElement("svg", [attribute], [], at)
          : createElement("svg", [], [createElement(tag, [attribute], [], at)], at),
      );
    }
  }
  return elements;
}

/** A component whose markup holds the elements, its value typed so that it fits anywhere. */
function component(markup: string): string {
  return `---\nconst { x } = Astro.props as { x: never };\n---\n\n${markup}\n`;
}

/** The element and attribute named on a printed line: `<img ismap={x} />`, `<img {...{ ismap`. */
function pairOn(line: string): string {
  const found = /<([A-Za-z]+) (?:\{\.\.\.\{ )?([^\s={]+)/.exec(line);
  if (!found) throw new Error(`No attribute on \`${line}\`.`);
  return `${found[1]} ${found[2]}`;
}

describe("attributes Astro's types do not declare (L4)", () => {
  it("are exactly the ones the target writes as spreads, which then pass", { timeout: 180_000 }, async () => {
    const elements = vocabulary();
    const render = createFragment(elements, at);
    const plain: MarkupDialect = astroDialect;
    const files = {
      plain: join(scratch.path, "Plain.astro"),
      target: join(scratch.path, "Target.astro"),
    };
    writeFileSync(files.plain, component(printMarkup(render, plain)));
    writeFileSync(files.target, component(printComponentMarkup(createComponent("T", render, at))));
    const results = await astroTypecheck(Object.values(files), {
      toolchainDir,
      root: integrationRoot,
    });

    const lines = readFileSync(files.plain, "utf8").split("\n");
    const failing = new Set(
      (results.get(files.plain) ?? []).map((message) => {
        expect(message.message, pairOn(lines[message.line! - 1]!)).toMatch(
          /Property '[^']+' does not exist on type/,
        );
        return pairOn(lines[message.line! - 1]!);
      }),
    );
    const untyped = new Set(
      elements.flatMap((element) => {
        const target = element.tag === "svg" && element.children.length ? element.children[0]! : element;
        if (target.kind !== "Element" || target.tag === "svg" || SVG_ELEMENTS.has(target.tag)) {
          return [];
        }
        const [attribute] = target.attributes;
        const name = attribute!.kind === "Static" || attribute!.kind === "Bound" ? attribute!.name : "";
        return isUntypedAttribute(target.tag, name) ? [`${target.tag} ${name}`] : [];
      }),
    );
    expect([...failing].toSorted()).toEqual([...untyped].toSorted());
    expect(results.get(files.target)).toEqual([]);
  });

  it("render as the attributes themselves: static, bare, bound and from a spread", async () => {
    const output = emitted(`interface Extra { nonce?: string; writingsuggestions?: string }
export interface MapProps { url: string; on: boolean; extra: Extra }
export default function Area({ url, on, extra }: MapProps) {
  return (
    <div>
      <img src="/a.png" alt="a" ismap />
      <img src="/a.png" alt="a" ismap={on} />
      <map name="m"><area href="/a" alt="a" ping={url} /></map>
      <form rel="noopener" autocorrect="off" aria-label="Search">x</form>
      <p autocorrect="on" {...extra}>y</p>
    </div>
  );
}`);
    expect(output.slice(output.indexOf("---\n\n", 4) + 5)).toBe(
      [
        "<div>",
        '  <img src="/a.png" alt="a" {...{ ismap: "" }} />',
        '  <img src="/a.png" alt="a" {...{ ismap: on ? "" : undefined }} />',
        '  <map name="m">',
        '    <area href="/a" alt="a" {...{ ping: url }} />',
        "  </map>",
        '  <form {...{ rel: "noopener" }} autocorrect="off" aria-label="Search">x</form>',
        "  <p",
        '    {...{ autocorrect: "on" }}',
        "    {...{ nonce: extra.nonce }}",
        "    {...{ writingsuggestions: extra.writingsuggestions }}",
        "  >y</p>",
        "</div>",
        "",
      ].join("\n"),
    );
    const html = await renderToString(await loadAstroComponent(scratch.path, output), {
      props: { url: "/p", on: false, extra: { nonce: "n", writingsuggestions: "" } },
    });
    expect(html).toBe(
      [
        '<div><img src="/a.png" alt="a" ismap><img src="/a.png" alt="a">',
        '<map name="m"><area href="/a" alt="a" ping="/p"></map>',
        '<form rel="noopener" autocorrect="off" aria-label="Search">x</form>',
        '<p autocorrect="on" nonce="n" writingsuggestions>y</p></div>',
      ].join(""),
    );
    const directory = join(scratch.path, "render");
    mkdirSync(directory, { recursive: true });
    const path = join(directory, "Area.astro");
    writeFileSync(path, output);
    expect(await astroTypecheck([path], { toolchainDir, root: integrationRoot })).toEqual(
      new Map([[path, []]]),
    );
  });
});
