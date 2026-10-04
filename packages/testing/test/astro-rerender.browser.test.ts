import type { MountedComponent } from "@unframework/codegen";
// The Astro mount adapter's rerender in Chromium (ADR-0043). Astro's own tests run in Node, and
// its adapter needs the page and the toolchain's `ufAstroRender` command, which this package's
// browser project provides (vitest.config.ts). A hand-written Astro component
// (./fixtures/Badge.uf.tsx.astro, named like the unplugin's virtual ids), rendered again with new
// props, updates its text, an attribute, a branch and a list, and a prop the new props lack takes
// its default again: a rerender is a new server render. Nothing is logged, on the server or here.
import { mount } from "@unframework/target-astro/toolchain/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

/** What the test reads back: the text, the attributes, the branch and the list. */
function read(container: HTMLElement) {
  const p = container.querySelector("p");
  return {
    label: p?.textContent,
    tone: p?.getAttribute("class"),
    count: p?.getAttribute("data-count"),
    warning: container.querySelector("strong")?.textContent ?? null,
    items: [...container.querySelectorAll("li")].map((li) => li.textContent),
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
  document.body.append(container);
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = undefined;
  container.remove();
  vi.restoreAllMocks();
});

it("replaces the props whole with a new server render", { timeout: 60_000 }, async () => {
  // Not a literal import: the type checker has no module for an Astro file.
  const fixture = new URL("./fixtures/Badge.uf.tsx.astro", import.meta.url).pathname;
  const { default: Badge } = (await import(/* @vite-ignore */ fixture)) as { default: unknown };
  mounted = await mount(Badge, container, {
    props: { label: "A", tone: "warn", items: ["x", "y"], count: 3 },
  });
  expect(mounted.console).toEqual([]);
  expect(read(container)).toEqual({
    label: "A",
    tone: "warn",
    count: "3",
    warning: "warning",
    items: ["x", "y"],
  });

  // `tone` and `count` are absent: `tone` takes its default, and `count` is gone.
  expect(await mounted.rerender({ label: "B", items: ["z"] })).toEqual({ console: [] });
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
  expect(container.children).toHaveLength(1);
  expect(logged).toEqual([]);
});

it("refuses props that cannot travel to the server as JSON, at a rerender as at mount", async () => {
  const fixture = new URL("./fixtures/Badge.uf.tsx.astro", import.meta.url).pathname;
  const { default: Badge } = (await import(/* @vite-ignore */ fixture)) as { default: unknown };
  mounted = await mount(Badge, container, { props: { label: "A" } });
  await expect(mounted.rerender({ label: "A", count: Number.NaN })).rejects.toThrow(
    "Astro renders on the server, so props must be JSON values; `count` is NaN.",
  );
  expect(read(container).label).toBe("A");
});
