// Solid's client render of composition's forms the corpus does not reach (src/composition.ts,
// src/models.ts): the fixtures are the emitter's own output (test/output.test.ts pins them). Each
// is rendered as a parent's compiled JSX passes its props, a slot's prop a getter that creates its
// content on every read, so a test counts how many times the output creates it.
import type { Component, JSX } from "solid-js";
import { createComponent, render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";

/** A fixture's component, loaded by URL: its Solid TSX is not this package's to type-check. */
async function fixture(name: string): Promise<Component<Record<string, unknown>>> {
  const url = new URL(`./fixtures/${name}.tsx`, import.meta.url).href;
  const { default: component } = (await import(/* @vite-ignore */ url)) as {
    default: Component<Record<string, unknown>>;
  };
  return component;
}

/** A slot's content as a parent's compiled JSX passes it: new each time it is read. */
function content(text: string, created: { count: number }): () => JSX.Element {
  return () => {
    created.count += 1;
    const span = document.createElement("span");
    span.textContent = text;
    return span;
  };
}

const container = document.createElement("div");
let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  container.replaceChildren();
  container.remove();
});

/** Renders a fixture with props, as a parent would. */
async function mount(name: string, props: Record<string, unknown>): Promise<void> {
  document.body.append(container);
  const component = await fixture(name);
  dispose = render(() => createComponent(component, props), container);
  await Promise.resolve();
}

it("renders a slot a list's row tests in every row, once each", async () => {
  const created = { count: 0 };
  const badge = content("badge", created);
  await mount("RowSlots", {
    items: ["a", "b", "c"],
    get badge() {
      return badge();
    },
  });
  expect([...container.querySelectorAll("li")].map((row) => row.innerHTML)).toEqual([
    "a<b><span>badge</span></b>",
    "b<b><span>badge</span></b>",
    "c<b><span>badge</span></b>",
  ]);
  expect(created.count).toBe(3);
});

it("creates a tested slot it forwards once", async () => {
  const created = { count: 0 };
  const body = content("body", created);
  await mount("ForwardedSlot", {
    depth: 1,
    get children() {
      return body();
    },
  });
  expect(
    [...container.querySelectorAll("[data-filled]")].map((each) =>
      each.getAttribute("data-filled"),
    ),
  ).toEqual(["yes", "yes"]);
  expect(created.count).toBe(1);
});

it("selects the option whose text, collapsed as the DOM's, is the state", async () => {
  await mount("OptionText", { unit: "kg" });
  const select = container.querySelector("select")!;
  expect(select.value).toBe("2 kg");
  expect(select.selectedIndex).toBe(1);
});

it("selects the option a child component renders", async () => {
  await mount("SelectRows", { values: ["x", "y"] });
  expect(container.querySelector("select")!.value).toBe("y");
});
