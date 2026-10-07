// The mount adapter's listeners (ADR-0047, ADR-0050): a hand-written component, compiled by
// ngtsc as the output is, with an `output()` per event, reaches the test's listeners through the
// output bindings the adapter creates it with. An output emits one value, so each payload comes
// back by its event's shape: no argument for an event without members, the value for one
// required member, the tuple's members otherwise; a rerender, which sets inputs, keeps them.
// Like the rerender test, it runs in Node on domino (this package has no browser project).
// oxlint-disable-next-line import/no-unassigned-import -- loaded for its side effect
import "@angular/compiler";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { ɵDominoAdapter as DominoAdapter } from "@angular/platform-server";
import type { MountedComponent, MountEvent } from "@unframework/codegen";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";

import { mount } from "../src/toolchain/client.ts";
import { ngtscPlugin, removeScratch, scratchDir } from "./helpers.ts";

/** A counter whose click emits an event of every payload shape. */
const COUNTER = `import { Component, input, output, signal } from "@angular/core";

@Component({
  selector: "uf-counter",
  host: { style: "display: contents" },
  template: \`<p>{{ count() }}</p><button type="button" (click)="add()">Add</button>\`,
})
export default class Counter {
  readonly step = input<number, number | undefined>(1, {
    transform: (value) => (value === undefined ? 1 : value),
  });
  readonly change = output<number>();
  readonly closed = output<void>();
  readonly moved = output<[x: number, y: number]>();
  readonly ping = output<[value?: number]>();
  protected readonly count = signal(0);

  protected add(): void {
    this.count.update((count) => count + this.step());
    this.change.emit(this.count());
    this.closed.emit();
    this.moved.emit([this.count(), -1]);
    this.ping.emit([]);
  }
}
`;

/** The events as the IR declares them, which the adapter reads the payloads' shapes from. */
const EVENTS: MountEvent[] = [
  { name: "change", optional: [false] },
  { name: "closed", optional: [] },
  { name: "moved", optional: [false, false] },
  { name: "ping", optional: [true] },
];

let Counter: unknown;
const globals = ["document", "window"] as const;
const saved = new Map<string, PropertyDescriptor | undefined>();

beforeAll(async () => {
  DominoAdapter.makeCurrent();
  const document = new DominoAdapter().createHtmlDocument();
  for (const name of globals) saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.assign(globalThis, { document, window: document.defaultView });

  const directory = scratchDir();
  const { transform } = await ngtscPlugin();
  const { code } = await transform(join(directory, "Counter.uf.tsx.ts"), COUNTER);
  const file = join(directory, "counter.js");
  writeFileSync(file, code);
  Counter = ((await import(pathToFileURL(file).href)) as { default: unknown }).default;
});

afterAll(() => {
  for (const name of globals) {
    const descriptor = saved.get(name);
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
  removeScratch();
});

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

/** Clicks the button as the page would. */
function click(): void {
  const event = document.createEvent("Event");
  event.initEvent("click", true, true);
  container.querySelector("button")!.dispatchEvent(event);
}

it("binds each listener to its event's output and gives the payload back by its shape", async () => {
  const calls: unknown[][] = [];
  const on = Object.fromEntries(
    EVENTS.map(({ name }) => [name, (...args: unknown[]) => void calls.push([name, ...args])]),
  );
  mounted = await mount(Counter, container, { on, events: EVENTS });
  click();
  await mounted.settle();
  // A rerender sets an input: the bindings stay.
  await mounted.rerender({ step: 5 });
  click();
  await mounted.settle();
  expect(container.querySelector("p")?.textContent).toBe("6");
  expect(calls).toEqual([
    ["change", 1],
    ["closed"],
    ["moved", 1, -1],
    ["ping"],
    ["change", 6],
    ["closed"],
    ["moved", 6, -1],
    ["ping"],
  ]);
  expect(logged).toEqual([]);
});

it("refuses a listener whose event's shape it was not told, and Angular one it has no output for", async () => {
  await expect(mount(Counter, container, { on: { change: () => undefined } })).rejects.toThrow(
    /the test listens to "change", which the component declares no payload for/,
  );
  await expect(
    mount(Counter, container, {
      on: { opened: () => undefined },
      events: [{ name: "opened", optional: [] }],
    }),
  ).rejects.toThrow(/NG0316/);
});
