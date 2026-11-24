// What the embed tests read in an embedded example (ADR-0116): its controls panel as the shell's
// groups describe it, where its first field sits, which of its boxes scroll, and a page on a
// second origin that frames it, sizes the iframe from its reports and records every message.
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import type { Frame, FrameLocator, Page } from "playwright";
import { expect } from "vitest";

import type { ExampleControlGroup } from "../src/preview/instrument.ts";

/** A page on a second origin, whose HTML a test sets before each load. */
export interface HostPage {
  url: string;
  set(html: string): void;
  close(): Promise<void>;
}

/** Serves the HTML a test sets, on another origin than the preview's. */
export async function hostPage(): Promise<HostPage> {
  let html = "";
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(html);
  });
  await new Promise<void>((done) => {
    server.listen(0, "127.0.0.1", done);
  });
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/`,
    set: (next) => void (html = next),
    close: () =>
      new Promise((done) => {
        server.close(() => done());
      }),
  };
}

/**
 * A host page that frames `src` in `#embed`, `height` tall (none for the default 150 px), records
 * every message it gets in `window.received`, and sets the iframe's height to each height the
 * embed reports, as Parts 4 and 5 of UXF-905's sites will.
 */
export function framing(src: string, height?: number): string {
  return [
    "<!doctype html>",
    '<body style="margin: 0">',
    `<iframe id="embed" style="border: 0; width: 400px;${height ? ` height: ${height}px;` : ""}" src="${src}"></iframe>`,
    "<script>",
    "  window.received = [];",
    "  addEventListener('message', (event) => {",
    "    window.received.push(event.data);",
    "    const iframe = document.getElementById('embed');",
    "    if (event.source !== iframe.contentWindow || event.data?.kind !== 'resize') return;",
    "    iframe.style.height = `${event.data.height}px`;",
    "  });",
    "</script>",
  ].join("\n");
}

/** The panel's groups, as an embed shows them, and as the catalogue's groups say they should be. */
export interface PanelGroup {
  component: string;
  name: string;
  controls: Array<string>;
  setByExample: Array<string>;
  uncontrolled: Array<string>;
}

/** The groups a panel should show for an example's controls (ADR-0113). */
export function expectedPanel(groups: ReadonlyArray<ExampleControlGroup>): Array<PanelGroup> {
  return groups.map((group) => ({
    component: group.component,
    name: group.name,
    controls: group.controls.map((control) => control.name),
    setByExample: group.setByExample,
    uncontrolled: group.uncontrolled.map((each) => `${each.name}: ${each.reason}.`),
  }));
}

/** The groups an embed's panel shows, read through its shadow root, or `null` with no panel. */
export function panel(frame: FrameLocator | Page | Frame): Promise<Array<PanelGroup> | null> {
  return frame.locator("body").evaluate(() => {
    const root = document.querySelector("uf-embed-controls")?.shadowRoot;
    if (!root) {
      return null;
    }
    const list = (group: Element, title: string) => {
      const heading = [...group.querySelectorAll("h4")].find((each) => each.textContent === title);
      return heading
        ? [...heading.nextElementSibling!.querySelectorAll("li")].map((each) => each.textContent)
        : [];
    };
    return [...root.querySelectorAll<HTMLElement>("[data-uf-group]")].map((group) => ({
      component: group.dataset.ufGroup!,
      name: group.querySelector("h3")!.textContent,
      controls: [...group.querySelectorAll("label")].map((each) => each.textContent),
      setByExample: list(group, "Set by the example"),
      uncontrolled: list(group, "Not controllable"),
    }));
  });
}

/** Where the example's `Save`, the panel and its first field sit in a frame, with the panel at its top. */
export interface FieldPlace {
  innerHeight: number;
  /** The example's area, which takes the space above the panel when the host sets the height. */
  area: { top: number; bottom: number };
  save: { top: number; bottom: number };
  panel: { top: number; bottom: number; scrollTop: number };
  label: { top: number; bottom: number };
  field: { top: number; bottom: number };
}

/** Reads where the first field of an embed's panel sits. */
export function fieldPlace(frame: FrameLocator | Page | Frame): Promise<FieldPlace> {
  return frame.locator("body").evaluate(() => {
    const host = document.querySelector<HTMLElement>("uf-embed-controls")!;
    const root = host.shadowRoot!;
    const box = (element: Element) => {
      const { top, bottom } = element.getBoundingClientRect();
      return { top, bottom };
    };
    const save = [...document.querySelectorAll("button")].find(
      (each) => each.textContent?.trim() === "Save",
    )!;
    return {
      innerHeight,
      area: box(document.querySelector("[data-uf-embed-example]")!),
      save: box(save),
      panel: { ...box(host), scrollTop: host.scrollTop },
      label: box(root.querySelector("label")!),
      field: box(root.querySelector("input, select")!),
    };
  });
}

/** Asserts the first field's whole box is in the frame's viewport and in the panel's visible box. */
export function expectFieldInView(place: FieldPlace, at: string): void {
  expect(place.panel.scrollTop, at).toBe(0);
  expect(place.save.bottom > 0 && place.save.top < place.innerHeight, at).toBe(true);
  for (const part of [place.label, place.field]) {
    expect(part.top, at).toBeGreaterThanOrEqual(Math.max(0, place.panel.top));
    expect(part.bottom, at).toBeLessThanOrEqual(Math.min(place.innerHeight, place.panel.bottom));
  }
}

/**
 * Asserts an embed in an iframe of the host's height fills it: the example's area from the top to
 * the panel, and the panel to the bottom, at most half the frame.
 */
export function expectFilled(place: FieldPlace, at: string): void {
  expect(place.area.top, at).toBe(0);
  expect(Math.abs(place.area.bottom - place.panel.top), at).toBeLessThanOrEqual(0.5);
  expect(Math.abs(place.panel.bottom - place.innerHeight), at).toBeLessThanOrEqual(0.5);
  expect(place.panel.bottom - place.panel.top, at).toBeLessThanOrEqual(place.innerHeight / 2 + 0.5);
}

/** Each box of an embed that could scroll: its height against what it shows. */
export interface Scrolls {
  document: [scroll: number, client: number];
  area: [scroll: number, client: number];
  panel: [scroll: number, client: number] | null;
  /** The example's container's height, which a report with no panel must not exceed. */
  example: number;
}

/** Reads an embed's boxes. */
export function scrolls(frame: FrameLocator | Page | Frame): Promise<Scrolls> {
  return frame.locator("body").evaluate(() => {
    const sizes = (element: Element): [number, number] => [
      element.scrollHeight,
      element.clientHeight,
    ];
    const host = document.querySelector("uf-embed-controls");
    return {
      document: sizes(document.documentElement),
      area: sizes(document.querySelector("[data-uf-embed-example]")!),
      panel: host ? sizes(host) : null,
      example: document.querySelector("[data-uf-preview-root]")!.getBoundingClientRect().height,
    };
  });
}

/** Asserts nothing in an embed scrolls. */
export function expectNoScroll(boxes: Scrolls, at: string): void {
  for (const [name, sizes] of Object.entries(boxes)) {
    if (!Array.isArray(sizes)) {
      continue;
    }
    expect(sizes[0], `${at}: ${name}`).toBeLessThanOrEqual(sizes[1]);
  }
}

/** The heights an embed has reported to the host page, in order. */
export async function reports(page: Page): Promise<Array<number>> {
  const received = await page.evaluate(
    () => (window as { received?: Array<unknown> }).received ?? [],
  );
  return received.flatMap((each) =>
    typeof each === "object" &&
    each !== null &&
    (each as { kind?: unknown }).kind === "resize" &&
    typeof (each as { height?: unknown }).height === "number"
      ? [(each as { height: number }).height]
      : [],
  );
}

/** Waits until the embed's reports settle: none in a second after the last, which it gives. */
export async function settled(page: Page, at: string): Promise<number> {
  await expect.poll(async () => (await reports(page)).length, { message: at }).toBeGreaterThan(0);
  // A report that never settles is the loop of ADR-0116's trap: thirty seconds of reports fail.
  for (let second = 0; second < 30; second += 1) {
    const before = (await reports(page)).length;
    await page.waitForTimeout(1000);
    const after = await reports(page);
    if (after.length === before) {
      return after.at(-1)!;
    }
  }
  throw new Error(`${at}: the reports never settled: ${JSON.stringify(await reports(page))}`);
}

/** The frame the host page holds in `#embed`. */
export async function embedFrame(page: Page): Promise<Frame> {
  const frame = await (await page.locator("#embed").elementHandle())?.contentFrame();
  if (!frame) {
    throw new Error("The host page frames nothing in #embed.");
  }
  return frame;
}
