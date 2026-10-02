// The browser half of the render-parity kit (./render-parity.ts): what a framework's client
// renderer builds, read from the live DOM, against the DOM the IR describes, built with the DOM's
// own methods. Client renderers take paths their server renderers do not (React's
// `createElement` and its form-control props, Vue's `patchProp`, the `<template>` clones of
// Svelte and Solid, Qwik's client renderer), so the server parity tests cannot speak for them.
//
// Two targets have no client test, because their client path is their server path: Astro
// renders only on the server (its browser mount inserts that HTML), and Angular's server
// platform runs the same AOT instructions through the same `DomRendererFactory2` as the
// browser, on domino's DOM, whose output its server parity test parses strictly.
import type { ElementNode } from "@unframework/ir";
import { describe, expect, it, vi } from "vitest";

import type { CapabilityName, MountAdapter } from "../src/index.ts";
import { comparableValue, compareCases, pushText } from "./render-parity.ts";
import type { DomElement, DomNode, ParityCase } from "./render-parity.ts";

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

/**
 * The DOM an IR element describes, built with `createElement`, `setAttribute` and
 * `createTextNode`: exactly its text and attributes, with no HTML parsing in between (JSX
 * semantics: a line feed at the start of a `<pre>` is content). Form controls then hold the
 * state those attributes give them.
 */
export function buildDom(node: ElementNode, document: Document = globalThis.document): Element {
  const element = document.createElement(node.tag);
  for (const attribute of node.attributes) {
    element.setAttribute(attribute.name, attribute.value === true ? "" : attribute.value);
  }
  for (const child of node.children) {
    element.append(
      child.kind === "Element" ? buildDom(child, document) : document.createTextNode(child.value),
    );
  }
  return element;
}

/**
 * Reads a live element as a comparable value: its attributes, its text (adjacent text nodes
 * merged, empty ones dropped) and its elements, and a form control's state (`value`,
 * `checked`, `selected`), which renderers may set as properties without the attribute.
 * Comments are framework anchors and are dropped. An element outside the HTML namespace is
 * named with its namespace, so one created in the wrong namespace differs.
 */
export function readDom(element: Element): DomElement {
  const attributes: Record<string, string> = {};
  for (const attribute of element.attributes) {
    attributes[attribute.name] = comparableValue(attribute.name, attribute.value);
  }
  const children: DomNode[] = [];
  for (const child of element.childNodes) {
    if (child instanceof Element) children.push(readDom(child));
    else if (child instanceof Text) pushText(children, child.data);
    else if (!(child instanceof Comment)) {
      throw new Error(`unexpected ${child.nodeName} node in <${element.localName}>`);
    }
  }
  const tag =
    element.namespaceURI === HTML_NAMESPACE
      ? element.localName
      : `${element.namespaceURI}:${element.localName}`;
  const read: DomElement = { tag, attributes, children };
  const state = formState(element);
  if (state) read.state = state;
  return read;
}

/** The state of a form control that its attributes only set initially. */
function formState(element: Element): Record<string, string> | undefined {
  if (element instanceof HTMLInputElement) {
    return { value: element.value, checked: String(element.checked) };
  }
  if (element instanceof HTMLTextAreaElement) return { value: element.value };
  if (element instanceof HTMLSelectElement) {
    return { value: element.value, selectedIndex: String(element.selectedIndex) };
  }
  if (element instanceof HTMLOptionElement) return { selected: String(element.selected) };
  return undefined;
}

/** The DOM a case describes, as {@link readDom} reads it. */
export function expectedDom(render: ElementNode): DomElement {
  return readDom(buildDom(render));
}

/** One component ./render-parity-manifest.ts lists. */
export interface ClientComponent {
  /** Whether it is the formatted output, or the printer's layout. */
  format: boolean;
  /** The case it renders alone, or `undefined` when it renders the whole suite in a `<div>`. */
  only: number | undefined;
  load(): Promise<{ default: unknown }>;
}

/** A case as ./render-parity-manifest.ts lists it, with what the target's matrix says of it. */
export interface ClientCase extends ParityCase {
  /** The capabilities it uses that the target's matrix marks unsupported. */
  unsupported: readonly CapabilityName[];
}

/** One suite ./render-parity-manifest.ts lists. */
export interface ClientSuite {
  title: string;
  cases: readonly ClientCase[];
  components: readonly ClientComponent[];
}

/**
 * The client render-parity tests of one target: every component the plugin serves is mounted
 * through the target's mount adapter, and the DOM it renders must be exactly the one its cases
 * describe, with nothing logged to the console meanwhile. A case that uses a capability the
 * target's matrix marks unsupported is left out of the comparisons, and must still render
 * differently alone: the day it does not, the matrix is wrong and must say the target supports
 * it. A capability no case uses is not checked.
 */
export function describeClientParity(
  target: string,
  suites: readonly ClientSuite[],
  mount: MountAdapter,
): void {
  describe.each(suites)(`${target} client render of $title`, ({ cases, components }) => {
    const whole = components.filter((component) => component.only === undefined);
    const alone = components.filter((component) => component.only !== undefined);
    // A suite the plugin served no component for, or only some of its cases alone, would pass
    // without rendering them; an unsupported case is only checked alone.
    if (
      !whole.length ||
      (alone.length && alone.length !== cases.length * whole.length) ||
      (!alone.length && cases.some(unsupported))
    ) {
      throw new Error(
        `${target}: the plugin served ${components.length} components for ${cases.length} cases${cases.some(unsupported) ? ", some of which use a capability its matrix marks unsupported (serve each case alone)" : ""}.`,
      );
    }

    it.each(whole)(
      "renders every case as the IR describes (formatted: $format)",
      async (component) => {
        const { rendered, logged } = await renderComponent(component, mount);
        expect(logged).toEqual([]);
        const [outline, ...results] = compareCases(rendered, cases, expectedDom);
        expect.soft(outline!.actual, outline!.name).toEqual(outline!.expected);
        results.forEach(({ name, expected, actual }, index) => {
          if (!unsupported(cases[index]!)) expect.soft(actual, name).toEqual(expected);
        });
      },
    );

    if (!alone.length) return;
    it("renders each case alone as the IR describes", async () => {
      for (const component of alone) {
        const only = cases[component.only!]!;
        if (unsupported(only)) continue;
        const { rendered, logged } = await renderComponent(component, mount);
        expect.soft(logged, only.name).toEqual([]);
        for (const { name, expected, actual } of compareCases(rendered, [only], expectedDom)) {
          expect.soft(actual, `${only.name}, alone: ${name}`).toEqual(expected);
        }
      }
    });

    const declared = alone.filter((component) => unsupported(cases[component.only!]!));
    if (!declared.length) return;
    it("still renders differently alone each case its matrix marks unsupported", async () => {
      for (const component of declared) {
        const only = cases[component.only!]!;
        const { rendered } = await renderComponent(component, mount);
        const [outline, result] = compareCases(rendered, [only], expectedDom);
        expect.soft(outline!.actual, `${only.name}, alone`).toEqual(outline!.expected);
        expect
          .soft(
            result!.actual,
            `${only.name} renders as the IR describes, though ${target}'s capability matrix marks ${only.unsupported.join(", ")} unsupported: change the matrix`,
          )
          .not.toEqual(result!.expected);
      }
    });
  });
}

/** Whether a case uses a capability the target's matrix marks unsupported. */
function unsupported(parityCase: ClientCase): boolean {
  return parityCase.unsupported.length > 0;
}

/** Mounts a component in a fresh container, reads what it rendered and unmounts it. */
async function renderComponent(
  component: ClientComponent,
  mount: MountAdapter,
): Promise<{ rendered: DomNode[]; logged: string[] }> {
  const { default: loaded } = await component.load();
  const container = document.createElement("div");
  document.body.append(container);
  const logged: string[] = [];
  const capture = (...args: unknown[]) => void logged.push(args.map(String).join(" "));
  const spies = [
    vi.spyOn(console, "error").mockImplementation(capture),
    vi.spyOn(console, "warn").mockImplementation(capture),
  ];
  try {
    const view = await mount(loaded, container, {});
    await view.settle();
    const rendered = readDom(container).children;
    await view.unmount();
    return { rendered, logged };
  } finally {
    for (const spy of spies) spy.mockRestore();
    container.remove();
  }
}
