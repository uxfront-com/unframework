// The attributes Astro's JSX types declare (L4): every (element, attribute) pair the analyser
// accepts, by element and by name, bound and (for booleans) bare, through `astro check`. Printed with the bare
// Astro dialect, exactly the pairs `isUntypedAttribute` names fail, as a missing declaration;
// printed as the target prints them, none does. So the target's list is neither short nor long.
// Values are typed `never` here: whether a value's type fits an attribute is the analyser's
// question (design §1.5), not a declaration's.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { astroDialect, printMarkup } from "@unframework/codegen";
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
  UNPORTABLE_ELEMENTS,
  UNRENDERABLE_ELEMENTS,
} from "@unframework/ir";
import type { Attribute, ElementNode } from "@unframework/ir";
import { afterAll, describe, expect, it } from "vitest";

// The analyser's verdict on a name, whatever its value: the pairs it rejects never reach a target.
import { nameProblem } from "../../analyzer/src/attribute-names.ts";
import { isUntypedAttribute, printComponentMarkup } from "../src/markup.ts";
import { astroTypecheck } from "../src/toolchain/check.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { loadAstroComponent, scratchDirectory } from "./astro.ts";
import { emitted } from "./source.ts";
import { integrationRoot, toolchainDir } from "./workspace.ts";

const scratch = scratchDirectory("attributes");
afterAll(() => scratch.remove());

const at = span(0, 0);

/** Attributes with forms of their own (ADR-0038). */
const OWN_FORMS = new Set(["class", "style"]);

/** Elements written at the top level of a component's markup that HTML would move or drop. */
const UNPLACEABLE = new Set(["html", "head", "body", "title", "base", "link", "meta", "noscript"]);

/** An attribute bound to `x`. */
const bound = (name: string) => createBoundAttribute(name, createExpression("x", at), at);

/**
 * One element per (element, attribute) pair the analyser accepts (an element it renders, a name
 * it takes there): bound to `x`, and bare when it is an HTML boolean attribute.
 */
function vocabulary(): ElementNode[] {
  const elements: ElementNode[] = [];
  const add = (tag: string, attribute: Attribute) =>
    elements.push(createElement(tag, [attribute], [], at));
  for (const tag of [...HTML_ELEMENTS].toSorted()) {
    if (UNRENDERABLE_ELEMENTS.has(tag) || UNPORTABLE_ELEMENTS.has(tag) || UNPLACEABLE.has(tag)) {
      continue;
    }
    const names = [
      ...GLOBAL_ATTRIBUTES,
      ...(ELEMENT_ATTRIBUTES.get(tag) ?? []),
      ...ARIA_ATTRIBUTES,
    ];
    for (const name of names.toSorted()) {
      if (OWN_FORMS.has(name)) continue;
      if (!nameProblem(tag, "html", name, name, true)) add(tag, bound(name));
      if (BOOLEAN_ATTRIBUTES.has(name) && !nameProblem(tag, "html", name, name, false)) {
        add(tag, createStaticAttribute(name, true, at));
      }
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
      if (OWN_FORMS.has(name) || nameProblem(tag, "svg", name, name, true)) continue;
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
  const found = /<([A-Za-z][A-Za-z0-9]*) (?:\{\.\.\.\{ )?([^\s={]+)/.exec(line);
  if (!found) throw new Error(`No attribute on \`${line}\`.`);
  return `${found[1]} ${found[2]}`;
}

describe("attributes Astro's types do not declare (L4)", () => {
  it(
    "are exactly the ones the target writes as spreads, which then pass",
    { timeout: 180_000 },
    async () => {
      const elements = vocabulary();
      // A few hundred elements per component: TypeScript's parser recurses once per sibling.
      const chunks = Array.from({ length: Math.ceil(elements.length / 400) }, (_, index) =>
        createFragment(elements.slice(index * 400, (index + 1) * 400), at),
      );
      const files = chunks.flatMap((render, index) => {
        const plain = join(scratch.path, `Plain${index}.astro`);
        const printed = join(scratch.path, `Target${index}.astro`);
        writeFileSync(plain, component(printMarkup(render, astroDialect)));
        writeFileSync(printed, component(printComponentMarkup(createComponent("T", render, at))));
        return [{ plain, printed }];
      });
      const results = await astroTypecheck(
        files.flatMap(({ plain, printed }) => [plain, printed]),
        { toolchainDir, root: integrationRoot },
      );

      const failing = new Set<string>();
      for (const { plain, printed } of files) {
        const lines = readFileSync(plain, "utf8").split("\n");
        for (const message of results.get(plain) ?? []) {
          const pair = pairOn(lines[message.line! - 1]!);
          expect(message.message, pair).toMatch(/Property '[^']+' does not exist on type/);
          failing.add(pair);
        }
        expect(results.get(printed), printed).toEqual([]);
      }
      const untyped = new Set(
        elements.flatMap((element) => {
          const [attribute] = element.attributes;
          if (element.tag === "svg" || !attribute) return [];
          const name =
            attribute.kind === "Static" || attribute.kind === "Bound" ? attribute.name : "";
          return isUntypedAttribute(element.tag, name) ? [`${element.tag} ${name}`] : [];
        }),
      );
      expect([...failing].toSorted()).toEqual([...untyped].toSorted());
    },
  );

  it(
    "render as the attributes themselves: static, bound and from a spread",
    { timeout: 60_000 },
    async () => {
      const output = emitted(`interface Typing { autocorrect?: "on" | "off" }
export interface NoteProps { mode: "on" | "off"; typing: Typing }
export default function Note({ mode, typing }: NoteProps) {
  return (
    <div>
      <form autocorrect="off" aria-label="Search">x</form>
      <p autocorrect="on">y</p>
      <p autocorrect={mode}>z</p>
      <p {...typing}>w</p>
    </div>
  );
}`);
      // Astro's types declare `autocorrect` on a form: it is written there as an attribute.
      expect(output.slice(output.indexOf("---\n\n", 4) + 5)).toBe(
        [
          "<div>",
          '  <form autocorrect="off" aria-label="Search">x</form>',
          '  <p {...{ autocorrect: "on" }}>y</p>',
          "  <p {...{ autocorrect: mode }}>z</p>",
          "  <p {...{ autocorrect: typing.autocorrect }}>w</p>",
          "</div>",
          "",
        ].join("\n"),
      );
      const html = await renderToString(await loadAstroComponent(scratch.path, output), {
        props: { mode: "off", typing: {} },
      });
      expect(html).toBe(
        [
          '<div><form autocorrect="off" aria-label="Search">x</form>',
          '<p autocorrect="on">y</p><p autocorrect="off">z</p><p>w</p></div>',
        ].join(""),
      );
      const directory = join(scratch.path, "render");
      mkdirSync(directory, { recursive: true });
      const path = join(directory, "Note.astro");
      writeFileSync(path, output);
      expect(await astroTypecheck([path], { toolchainDir, root: integrationRoot })).toEqual(
        new Map([[path, []]]),
      );
    },
  );
});
