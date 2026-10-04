// The mount adapter's rerender (ADR-0043): a hand-written component, compiled by ngtsc as the
// output is, mounted by the toolchain's browser adapter and rendered again with new props,
// updates its text, an attribute, a branch and a list, and an input the new props lack takes
// its default again through the emitted input's transform. The adapter settles before it
// resolves, so the DOM is read at once, and nothing is logged.
//
// This package has no browser project (see render-parity-client.ts in codegen): the adapter runs
// in Node, on the DOM Angular's server platform uses (domino), through the same renderer as in
// the browser. Angular's own packages ship partially compiled; in this plain-Node project the
// JIT compiler finishes them as they load. The component itself is compiled ahead of time.
// oxlint-disable-next-line import/no-unassigned-import -- loaded for its side effect
import "@angular/compiler";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { ɵDominoAdapter as DominoAdapter } from "@angular/platform-server";
import type { MountedComponent } from "@unframework/codegen";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";

import { mount } from "../src/toolchain/client.ts";
import { component, ngtscPlugin, removeScratch, scratchDir } from "./helpers.ts";

/** The shape every target's rerender test renders, with the inputs §5.5 of the design emits. */
const BADGE = component(
  "Badge",
  [
    '<div><p [class]="tone()" [attr.data-count]="count()">{{ label() }}</p>',
    "@if (tone() === 'warn') {<strong>warning</strong>}",
    "<ul>@for (item of items(); track item) {<li>{{ item }}</li>}</ul></div>",
  ].join(""),
  `
  readonly label = input.required<string>();
  readonly tone = input<"info" | "warn", "info" | "warn" | undefined>("info", {
    transform: (value) => (value === undefined ? "info" : value),
  });
  readonly items = input<string[], string[] | undefined>([], {
    transform: (value) => (value === undefined ? [] : value),
  });
  readonly count = input<number | undefined>();
`,
);

let Badge: unknown;
const globals = ["document", "window"] as const;
const saved = new Map<string, PropertyDescriptor | undefined>();

beforeAll(async () => {
  // Domino's DOM as the page's: its node types and a document, which the browser platform reads
  // from `document`.
  DominoAdapter.makeCurrent();
  const document = new DominoAdapter().createHtmlDocument();
  for (const name of globals) saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.assign(globalThis, { document, window: document.defaultView });

  const directory = scratchDir();
  const { transform } = await ngtscPlugin();
  const { code } = await transform(join(directory, "Badge.uf.tsx.ts"), BADGE);
  const file = join(directory, "badge.js");
  writeFileSync(file, code);
  Badge = ((await import(pathToFileURL(file).href)) as { default: unknown }).default;
});

afterAll(() => {
  for (const name of globals) {
    const descriptor = saved.get(name);
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
  removeScratch();
});

/** What the test reads back: the text, the attributes, the branch and the list. */
function read(container: HTMLElement) {
  const p = container.querySelector("p");
  return {
    label: p?.textContent,
    tone: p?.getAttribute("class"),
    count: p?.getAttribute("data-count"),
    warning: container.querySelector("strong")?.textContent ?? null,
    // Domino's lists are not iterable.
    items: Array.from(container.querySelectorAll("li"), (li) => li.textContent),
  };
}

const logged: unknown[][] = [];
let container: HTMLElement;
let mounted: MountedComponent | undefined;

beforeEach(() => {
  logged.length = 0;
  vi.spyOn(console, "warn").mockImplementation((...args) => void logged.push(args));
  vi.spyOn(console, "error").mockImplementation((...args) => void logged.push(args));
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = undefined;
  container.remove();
  vi.restoreAllMocks();
});

it("replaces the props whole, updating text, attributes, branches and lists", async () => {
  mounted = await mount(Badge, container, {
    props: { label: "A", tone: "warn", items: ["x", "y"], count: 3 },
  });
  expect(read(container)).toEqual({
    label: "A",
    tone: "warn",
    count: "3",
    warning: "warning",
    items: ["x", "y"],
  });

  // `tone` and `count` are absent: `tone` takes its default, and `count` is gone.
  await mounted.rerender({ label: "B", items: ["z"] });
  expect(read(container)).toEqual({
    label: "B",
    tone: "info",
    count: null,
    warning: null,
    items: ["z"],
  });

  // Back again, and `items` absent now takes its default.
  await mounted.rerender({ label: "C", tone: "warn", count: 0 });
  expect(read(container)).toEqual({
    label: "C",
    tone: "warn",
    count: "0",
    warning: "warning",
    items: [],
  });
  expect(logged).toEqual([]);
});

it("reports a prop that is not an input, as at mount", async () => {
  mounted = await mount(Badge, container, { props: { label: "A" } });
  await mounted.rerender({ label: "A", colour: "red" });
  expect(logged.map((args) => String(args[0]))).toEqual([
    expect.stringMatching(
      /^NG0303: Can't set value of the 'colour' input on the 'Badge' component/,
    ),
  ]);
});
