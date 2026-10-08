// UF3030 mirrors Svelte 5.57.1's handler-dependent accessibility warnings (ADR-0047): its tables
// are pinned against Svelte's own (`constants.js`, built from aria-query and axobject-query), each
// of the five rules against Svelte's compiler on its trigger, and every element of HTML, with each
// handler, role and `tabindex` the rules read, against the compiler too. A Svelte upgrade that adds
// a rule or moves a table fails here.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import { HTML_ELEMENTS, isVoidElement } from "@unframework/ir";
import { compile } from "svelte/compiler";
import { describe, expect, it } from "vitest";

import {
  ABSTRACT_ROLES,
  handlerProblems,
  INTERACTIVE_AX_SCHEMAS,
  INTERACTIVE_HANDLERS,
  INTERACTIVE_ROLE_SCHEMAS,
  INTERACTIVE_ROLES,
  NON_INTERACTIVE_AX_SCHEMAS,
  NON_INTERACTIVE_ROLE_SCHEMAS,
  NON_INTERACTIVE_ROLES,
  PRESENTATION_ROLES,
  RECOMMENDED_HANDLERS,
} from "../src/a11y.ts";
import type { A11yValue } from "../src/a11y.ts";
import { problems, setupOf } from "./helpers.ts";

const require = createRequire(import.meta.url);
const svelteRoot = require.resolve("svelte/package.json").replace(/package\.json$/, "");

/** Svelte's tables, read from the installed compiler. */
const constants = (await import(
  pathToFileURL(`${svelteRoot}src/compiler/phases/2-analyze/visitors/shared/a11y/constants.js`).href
)) as Record<string, unknown>;

/** The five rules UF3030 mirrors. */
const RULES = new Set([
  "a11y_click_events_have_key_events",
  "a11y_interactive_supports_focus",
  "a11y_mouse_events_have_key_events",
  "a11y_no_noninteractive_element_interactions",
  "a11y_no_static_element_interactions",
]);

/** A schema as text: `input[list,type=email]`. */
function schemaText(schema: {
  name: string;
  attributes?: readonly { name: string; value?: string }[];
}): string {
  return schema.attributes
    ? `${schema.name}[${schema.attributes.map((item) => (item.value === undefined ? item.name : `${item.name}=${item.value}`)).join(",")}]`
    : schema.name;
}

/** The warnings of the five rules Svelte gives each line of a markup, by line. */
function svelteWarnings(markup: string): Map<number, string[]> {
  const { warnings } = compile(markup, { generate: false, filename: "Probe.svelte" });
  const found = new Map<number, string[]>();
  for (const warning of warnings) {
    if (!RULES.has(warning.code)) continue;
    const line = warning.start!.line;
    found.set(line, [...(found.get(line) ?? []), warning.code].toSorted());
  }
  return found;
}

/** The rules the analyser's tables give an element, sorted. */
function ours(
  tag: string,
  attributes: Readonly<Record<string, A11yValue>>,
  handlers: readonly string[],
): string[] {
  return handlerProblems(tag, new Map(Object.entries(attributes)), new Set(handlers))
    .map((problem) => problem.rule)
    .toSorted();
}

/** An element in Svelte's markup, with its static attributes and its listeners. */
function markupOf(
  tag: string,
  attributes: Readonly<Record<string, A11yValue>>,
  handlers: readonly string[],
): string {
  const parts = [
    ...Object.entries(attributes).map(([name, value]) =>
      value === true ? name : value === null ? `${name}={dynamic}` : `${name}="${value}"`,
    ),
    ...handlers.map((handler) => `on${handler}={handle}`),
  ];
  return isVoidElement(tag)
    ? `<${tag} ${parts.join(" ")} />`
    : `<${tag} ${parts.join(" ")}>x</${tag}>`;
}

describe("UF3030's tables", () => {
  it("are Svelte's", () => {
    const schemas = (name: string) =>
      (constants[name] as { name: string; attributes?: { name: string; value?: string }[] }[]).map(
        schemaText,
      );
    expect(INTERACTIVE_ROLE_SCHEMAS.map(schemaText)).toEqual(
      schemas("interactive_element_role_schemas"),
    );
    expect(NON_INTERACTIVE_ROLE_SCHEMAS.map(schemaText)).toEqual(
      schemas("non_interactive_element_role_schemas"),
    );
    expect(INTERACTIVE_AX_SCHEMAS.map(schemaText)).toEqual(
      schemas("interactive_element_ax_object_schemas"),
    );
    expect(NON_INTERACTIVE_AX_SCHEMAS.map(schemaText)).toEqual(
      schemas("non_interactive_element_ax_object_schemas"),
    );
    expect([...INTERACTIVE_ROLES]).toEqual(constants.interactive_roles);
    expect([...NON_INTERACTIVE_ROLES]).toEqual(constants.non_interactive_roles);
    expect([...ABSTRACT_ROLES]).toEqual(constants.abstract_roles);
    expect([...PRESENTATION_ROLES]).toEqual(constants.presentation_roles);
    expect([...INTERACTIVE_HANDLERS]).toEqual(constants.a11y_interactive_handlers);
    expect([...RECOMMENDED_HANDLERS]).toEqual(constants.a11y_recommended_interactive_handlers);
  });
});

describe("UF3030's rules", () => {
  // Each rule's trigger, compiled through Svelte's compiler, and through the analyser.
  it.each([
    ["a11y_click_events_have_key_events", "div", {}, ["click"]],
    ["a11y_no_static_element_interactions", "span", {}, ["keydown"]],
    ["a11y_no_noninteractive_element_interactions", "li", {}, ["click", "keydown"]],
    ["a11y_interactive_supports_focus", "div", { role: "button" }, ["click", "keydown"]],
    ["a11y_mouse_events_have_key_events", "button", { type: "button" }, ["mouseover"]],
    ["a11y_mouse_events_have_key_events", "button", { type: "button" }, ["mouseout"]],
  ] as const)("reports %s as Svelte does", (rule, tag, attributes, handlers) => {
    const markup = `<script>let { handle, dynamic } = $props();</script>\n${markupOf(tag, attributes, handlers)}`;
    const svelte = svelteWarnings(markup).get(2) ?? [];
    expect(svelte).toContain(rule);
    expect(ours(tag, attributes, handlers)).toEqual(svelte);
  });

  it("is what Svelte's compiler says of every element, with each handler, role and tabindex", () => {
    const handlerSets = [
      ["click"],
      ["keydown"],
      ["click", "keydown"],
      ["mouseover"],
      ["mouseout", "blur"],
      ["wheel"],
      ["pointerdown"],
    ];
    const attributeSets: Record<string, A11yValue>[] = [
      {},
      { role: "button" },
      { role: "button", tabindex: "0" },
      { role: "presentation" },
      { role: "listitem" },
      { role: "group" },
      { role: null },
      { "aria-hidden": "true" },
      { disabled: true },
      { href: "/x" },
      { type: "checkbox" },
      { contenteditable: "true" },
    ];
    // The document's own elements, and `<slot>`, which Svelte reads as its own syntax.
    const skipped = new Set([
      "html",
      "head",
      "body",
      "script",
      "style",
      "template",
      "title",
      "slot",
    ]);
    let compared = 0;
    let flagged = 0;
    for (const tag of [...HTML_ELEMENTS].filter((name) => !skipped.has(name))) {
      const cases: { attributes: Record<string, A11yValue>; handlers: string[] }[] = [];
      for (const attributes of attributeSets) {
        for (const handlers of handlerSets) cases.push({ attributes, handlers });
      }
      const markup = [
        "<script>let { handle, dynamic } = $props();</script>",
        ...cases.map(({ attributes, handlers }) => markupOf(tag, attributes, handlers)),
      ].join("\n");
      let svelte: Map<number, string[]>;
      try {
        svelte = svelteWarnings(markup);
      } catch {
        // Svelte refuses the element at a component's root (`<tr>`, `<option>`…).
        continue;
      }
      for (const [index, { attributes, handlers }] of cases.entries()) {
        const expected = svelte.get(index + 2) ?? [];
        expect(ours(tag, attributes, handlers), markupOf(tag, attributes, handlers)).toEqual(
          expected,
        );
        compared++;
        if (expected.length) flagged++;
      }
    }
    expect(compared).toBeGreaterThan(8000);
    expect(flagged).toBeGreaterThan(1000);
  });
});

describe("UF3030 on components", () => {
  it("reports each rule at the element", () => {
    const { source, diagnostics } = setupOf(
      "function go() {}",
      '<section><div onClick={go}>x</div><li onClick={go} onKeydown={go}>x</li><div role="button" onClick={go} onKeydown={go}>x</div><button type="button" onMouseover={go}>x</button></section>',
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF3030 div",
      "UF3030 div",
      "UF3030 li",
      "UF3030 div",
      "UF3030 button",
    ]);
    expect(diagnostics.map((diagnostic) => /`(a11y_\w+)`/.exec(diagnostic.message)?.[1])).toEqual([
      "a11y_click_events_have_key_events",
      "a11y_no_static_element_interactions",
      "a11y_no_noninteractive_element_interactions",
      "a11y_interactive_supports_focus",
      "a11y_mouse_events_have_key_events",
    ]);
  });

  it("counts a listener with an option by its event, and a spread's keys as unknown values", () => {
    const { source, diagnostics } = setupOf(
      "function go() {}",
      '<section><div onClickCapture={go}>x</div><div role="button" {...attrs} onClick={go} onKeydown={go}>x</div></section>',
      "attrs: { tabindex: number }",
    );
    expect(problems(source, diagnostics)).toEqual(["UF3030 div", "UF3030 div"]);
  });

  it("accepts buttons, form controls, presentation, hidden elements and focusable roles", () => {
    const { diagnostics } = setupOf(
      "function go() {}",
      '<section><button type="button" onClick={go}>x</button><input onKeydown={go} /><div role="presentation" onClick={go}>x</div><div aria-hidden="true" onClick={go}>x</div><div role="button" tabindex="0" onClick={go} onKeydown={go}>x</div><div role="group" aria-label="Volume" onWheel={go}>x</div><a href="/x" onClick={go}>x</a><button type="button" onMouseover={go} onFocus={go}>x</button></section>',
    );
    expect(diagnostics).toEqual([]);
  });
});
