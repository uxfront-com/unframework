// The browser half of the render-parity kit (./render-parity.ts): what a framework's client
// renderer builds for a suite's props, read from the live DOM, against the DOM the reference
// describes (the expected trees the plugin lists), built with the DOM's own methods. Client renderers take paths their server renderers do not (React's
// `createElement` and its form-control props, Vue's `patchProp`, the `<template>` clones of
// Svelte and Solid, Qwik's client renderer), so the server parity tests cannot speak for them.
//
// Two targets have no client test, because their client path is their server path: Astro
// renders only on the server (its browser mount inserts that HTML), and Angular's server
// platform runs the same AOT instructions through the same `DomRendererFactory2` as the
// browser, on domino's DOM, whose output its server parity test parses strictly.
import { elementNamespace } from "@unframework/ir";
import type { ElementNode, FragmentNode, Namespace } from "@unframework/ir";
import { describe, expect, it, vi } from "vitest";

import type { CapabilityName, MountAdapter } from "../src/index.ts";
import { comparableValue, compareRendered, pushText } from "./render-parity.ts";
import type { DomElement, DomNode, ExpectedCase, SuiteRoot } from "./render-parity.ts";

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/**
 * The DOM a static IR element describes, built with `createElement` (`createElementNS` inside an
 * `<svg>`), `setAttribute` and `createTextNode`: exactly its text and attributes, with no HTML
 * parsing in between (JSX semantics: a line feed at the start of a `<pre>` is content). Form
 * controls then hold the state those attributes give them.
 */
export function buildDom(
  node: ElementNode,
  document: Document = globalThis.document,
  parent: Namespace = "html",
): Element {
  const namespace = elementNamespace(node.tag, parent);
  const element =
    namespace === "svg"
      ? document.createElementNS(SVG_NAMESPACE, node.tag)
      : document.createElement(node.tag);
  for (const attribute of node.attributes) {
    if (attribute.kind !== "Static") throw new Error(`a ${attribute.kind} attribute is not static`);
    element.setAttribute(attribute.name, attribute.value === true ? "" : attribute.value);
  }
  for (const child of node.children) {
    if (child.kind === "Element") element.append(buildDom(child, document, namespace));
    else if (child.kind === "Text") element.append(document.createTextNode(child.value));
    else throw new Error(`a ${child.kind} node is not static`);
  }
  return element;
}

/**
 * Reads a live element as a comparable value: its attributes (as `comparableValue` compares
 * them), its text (adjacent text nodes merged, empty ones dropped) and its elements, and a form
 * control's state (`value`, `checked`, `selected`), which renderers may set as properties
 * without the attribute. A `style` is read through the CSSOM (`style.cssText`), as the browser
 * applies it: a renderer may set declarations one by one, which the attribute then holds in
 * the CSSOM's own format. Comments are framework anchors and are dropped. An element outside
 * the HTML namespace is named with its namespace, so one created in the wrong namespace differs.
 */
export function readDom(element: Element): DomElement {
  const html = element.namespaceURI === HTML_NAMESPACE;
  const attributes: Record<string, string> = {};
  for (const attribute of element.attributes) {
    const text =
      attribute.name === "style" && "style" in element
        ? (element as HTMLElement).style.cssText
        : attribute.value;
    const value = comparableValue(attribute.name, text, html ? "html" : "svg");
    if (value !== undefined) attributes[attribute.name] = value;
  }
  const children: DomNode[] = [];
  for (const child of element.childNodes) {
    if (child instanceof Element) children.push(readDom(child));
    else if (child instanceof Text) pushText(children, child.data);
    else if (!(child instanceof Comment)) {
      throw new Error(`unexpected ${child.nodeName} node in <${element.localName}>`);
    }
  }
  const tag = html ? element.localName : `${element.namespaceURI}:${element.localName}`;
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

/**
 * The DOM nodes a static tree describes, as {@link readDom} reads them: an element, or a root
 * fragment's nodes, built in a container as a component's roots are mounted in one.
 */
export function expectedDom(tree: ElementNode | FragmentNode): DomNode[] {
  if (tree.kind === "Element") return [readDom(buildDom(tree))];
  const container = document.createElement("div");
  for (const child of tree.children) {
    if (child.kind === "Element") container.append(buildDom(child));
    else if (child.kind === "Text") container.append(document.createTextNode(child.value));
    else throw new Error(`a ${child.kind} node is not static`);
  }
  return readDom(container).children;
}

/** One component ./render-parity-manifest.ts lists. */
export interface ClientComponent {
  /** Whether it is the formatted output, or the printer's layout. */
  format: boolean;
  /** The case it renders alone, or `undefined` when it renders the whole suite. */
  only: number | undefined;
  /** The props it renders with (`parityProps`). */
  props: Readonly<Record<string, unknown>>;
  load(): Promise<{ default: unknown }>;
}

/** A case as ./render-parity-manifest.ts lists it, with what the target's matrix says of it. */
export interface ClientCase {
  name: string;
  /** What it renders, as a static tree (`expectedTree`). */
  expected: ElementNode | FragmentNode;
  /** The capabilities it uses that the target's matrix marks unsupported. */
  unsupported: readonly CapabilityName[];
}

/** One suite ./render-parity-manifest.ts lists. */
export interface ClientSuite {
  title: string;
  root: SuiteRoot;
  cases: readonly ClientCase[];
  components: readonly ClientComponent[];
}

/**
 * The client render-parity tests of one target: every component the plugin serves is mounted
 * through the target's mount adapter with its props, and the DOM it renders must be exactly the
 * one its cases describe, with nothing logged to the console meanwhile. A case that uses a
 * capability the target's matrix marks unsupported is left out of the comparisons, and must
 * still render differently alone: the day it does not, the matrix is wrong and must say the
 * target supports it. A capability no case uses is not checked.
 */
export function describeClientParity(
  target: string,
  suites: readonly ClientSuite[],
  mount: MountAdapter,
): void {
  describe.each(suites)(`${target} client render of $title`, ({ root, cases, components }) => {
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
    let expected: ExpectedCase[] | undefined;
    /** What each case renders, read from a DOM built for it: once per suite. */
    const expectations = () =>
      (expected ??= cases.map(({ name, expected: tree }) => ({ name, nodes: expectedDom(tree) })));

    it.each(whole)(
      "renders every case as the reference describes (formatted: $format)",
      async (component) => {
        const { rendered, logged } = await renderComponent(component, mount);
        expect(logged).toEqual([]);
        const [outline, ...results] = compareRendered(rendered, root, expectations());
        expect.soft(outline!.actual, outline!.name).toEqual(outline!.expected);
        results.forEach(({ name, expected: tree, actual }, index) => {
          if (!unsupported(cases[index]!)) expect.soft(actual, name).toEqual(tree);
        });
      },
    );

    if (!alone.length) return;
    it("renders each case alone as the reference describes", async () => {
      for (const component of alone) {
        const only = cases[component.only!]!;
        if (unsupported(only)) continue;
        const { rendered, logged } = await renderComponent(component, mount);
        expect.soft(logged, only.name).toEqual([]);
        const results = compareRendered(rendered, root, [expectations()[component.only!]!]);
        for (const { name, expected: tree, actual } of results) {
          expect.soft(actual, `${only.name}, alone: ${name}`).toEqual(tree);
        }
      }
    });

    const declared = alone.filter((component) => unsupported(cases[component.only!]!));
    if (!declared.length) return;
    it("still renders differently alone each case its matrix marks unsupported", async () => {
      for (const component of declared) {
        const only = cases[component.only!]!;
        const { rendered } = await renderComponent(component, mount);
        const [outline, result] = compareRendered(rendered, root, [
          expectations()[component.only!]!,
        ]);
        expect.soft(outline!.actual, `${only.name}, alone`).toEqual(outline!.expected);
        expect
          .soft(
            result!.actual,
            `${only.name} renders as the reference describes, though ${target}'s capability matrix marks ${only.unsupported.join(", ")} unsupported: change the matrix`,
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
    const view = await mount(loaded, container, { props: component.props });
    await view.settle();
    const rendered = readDom(container).children;
    await view.unmount();
    return { rendered, logged };
  } finally {
    for (const spy of spies) spy.mockRestore();
    container.remove();
  }
}
