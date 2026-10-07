// Solid's client render of what the target rewrites for Solid (src/render.ts,
// src/attributes.ts, src/narrowing.ts): the fixtures are the emitter's own output
// (test/output.test.ts pins them, and renders them on the server).
import { afterEach, expect, it, vi } from "vitest";

import { mount } from "../src/toolchain/client.ts";

/** A fixture's component, loaded by URL: its Solid TSX is not this package's to type-check. */
async function fixture(name: string): Promise<unknown> {
  const url = new URL(`./fixtures/${name}.tsx`, import.meta.url).href;
  const { default: component }: { default: unknown } = await import(/* @vite-ignore */ url);
  return component;
}

const container = document.createElement("div");
afterEach(() => {
  container.replaceChildren();
  container.remove();
});

it("keeps every line feed of a <pre> whose lines are expressions", async () => {
  document.body.append(container);
  const mounted = await mount(await fixture("Address"), container, {
    props: { name: "Ada", street: "12 St James's Square", city: "London" },
  });
  expect(container.querySelector("pre")!.textContent).toBe("Ada\n12 St James's Square\nLondon");
  await mounted.rerender?.({ name: "", street: "1 Navy Way" });
  expect(container.querySelector("pre")!.textContent).toBe("\n1 Navy Way\n-");
  await mounted.unmount();
});

it("sets the attributes it spreads, as Solid's types lack them, and updates them", async () => {
  document.body.append(container);
  const props = { colour: "red", turn: "rotate(45)", paint: { fill: "blue", id: "end" }, order: 2 };
  const mounted = await mount(await fixture("Swatch"), container, { props });
  const attributes = (selector: string, index = 0) => {
    const element = container.querySelectorAll(selector)[index]!;
    return [
      element.namespaceURI,
      ...[...element.attributes].map(({ name, value }) => `${name}=${value}`).toSorted(),
    ];
  };
  const svg = "http://www.w3.org/2000/svg";
  expect(attributes("linearGradient")).toEqual([
    svg,
    "id=swatch-fill",
    "opacity=0.5",
    "transform=rotate(45)",
  ]);
  expect(attributes("stop")).toEqual([svg, "fill=red", "offset=0"]);
  expect(attributes("stop", 1)).toEqual([svg, "fill=blue", "id=end"]);
  expect(attributes("mpath")).toEqual([svg, "href=#swatch-path"]);
  expect(attributes("dialog")).toEqual(["http://www.w3.org/1999/xhtml", "open=", "tabindex=2"]);
  await mounted.rerender?.({ ...props, colour: "green", paint: { id: "end" }, order: 3 });
  expect(attributes("stop")).toEqual([svg, "fill=green", "offset=0"]);
  expect(attributes("stop", 1)).toEqual([svg, "id=end"]);
  expect(attributes("dialog")).toEqual(["http://www.w3.org/1999/xhtml", "open=", "tabindex=3"]);
  await mounted.unmount();
});

// A branch that reads what its tests narrow takes the values from a keyed callback: the
// branches come and go as the tests flip, a new value renders its branch again, and nothing
// inside reads a value its test no longer guards (nothing thrown or logged), nested
// conditionals and lists included.
it("updates the branches that narrow, as their references come and go", async () => {
  document.body.append(container);
  const logged: unknown[][] = [];
  vi.spyOn(console, "warn").mockImplementation((...args) => void logged.push(args));
  vi.spyOn(console, "error").mockImplementation((...args) => void logged.push(args));
  const ada = {
    name: "Ada",
    nick: " A ",
    admin: true,
    age: 30.4,
    tags: ["t"],
    address: { city: "London" },
    link: { href: "#a" },
  };
  const props = {
    user: ada,
    note: "n",
    rows: [null, { name: "R", age: 2.6, tags: [] }],
    ready: true,
    places: ["x"],
    count: 1.4,
    value: "abc",
    shape: { kind: "circle", r: 2 },
    result: { ok: true, value: "V" },
    label: "L",
    format: { separator: ";" },
  };
  const mounted = await mount(await fixture("Narrowing"), container, { props });
  const texts = () => [...container.firstElementChild!.children].map((child) => child.textContent);
  const nickTitle = () => container.querySelector("p[title]")!.getAttribute("title");
  const ada6 = ["Ada", "Ada", "Ada", "Ada", "Ada", "Ada"];
  // Then an else that reads through `?.` what its test reads only where it holds, a list's
  // callback and an arrow that read the narrowed user, and two branches of one interpolation
  // that read the label too.
  const tail = ["n", "ABC", "", "V", ";;", "Ada", "Ada", "a", "Ada", "Ada: x", "Adax", "AdaL"];
  expect(texts()).toEqual([...ada6, "30Ada", "London", "t", "-RR3", "1", "1.4", ...tail, "1.4L"]);
  expect(nickTitle()).toBe("A");
  const paragraph = container.querySelectorAll("p")[0];
  // The narrowed values change in place; some tests flip.
  await mounted.rerender?.({
    ...props,
    user: { ...ada, name: "Bo", nick: undefined, admin: false, age: undefined },
    count: 2.6,
    note: null,
    value: 2.5,
    shape: { kind: "square", side: 3 },
    result: { ok: false, error: "E" },
    label: "",
    format: { separator: null },
  });
  const bo = ["Bo", "Bo", "Bo", "Bo", "-Bo", "London", "t", "-RR3", "3", "2.6", "2.5", ""];
  expect(texts()).toEqual([...bo, "E", "Bo", "Bo", "a", "Bo", "Bo: x", "Box", "Bo", "2.6"]);
  expect(nickTitle()).toBe("none");
  // Not keyed, a branch whose value changed (another user) keeps its DOM and reads the new
  // value through its accessor (ADR-0036 as M2 amends it).
  expect(container.querySelectorAll("p")[0]).toBe(paragraph);
  // Every reference absent, or of the other type.
  await mounted.rerender?.({
    rows: [],
    ready: true,
    places: [],
    note: " n ",
    value: "x",
    shape: { kind: "circle", r: 5 },
    result: { ok: true, value: "W" },
    label: "",
    format: { separator: "," },
  });
  const absent = [
    "anon",
    "n",
    "anon",
    "",
    "none",
    " n ",
    "X",
    "",
    "W",
    ",,",
    "",
    "a",
    "anon",
    "",
    "",
  ];
  expect(texts()).toEqual(absent);
  expect(container.firstElementChild!.textContent).toContain("<anonymous>");
  // Not ready: the chain's first test holds, and the branch inside the user's hides.
  await mounted.rerender?.({ ...props, ready: false });
  expect(texts()).toEqual([
    ...ada6.slice(0, 3),
    "wait",
    "Ada",
    "Ada",
    "30",
    "London",
    "t",
    "-RR3",
    "1",
    "1.4",
    ...tail,
    "1.4L",
  ]);
  const rows = [{ name: "S", tags: [] }, null];
  await mounted.rerender?.({ ...props, count: 7, rows });
  const seven = [...ada6, "30Ada", "London", "t", "S--", "7", "7.0", ...tail.slice(0, -1)];
  expect(texts()).toEqual([...seven, "AdaL", "7.0L"]);
  // The same user and count, another label: a branch whose value stays renders the label, as
  // Solid runs a branch's callback untracked and only its fragment's memo reads the label.
  await mounted.rerender?.({ ...props, count: 7, rows, label: "M" });
  expect(texts()).toEqual([...seven, "AdaM", "7.0M"]);
  await mounted.unmount();
  vi.restoreAllMocks();
  expect(logged).toEqual([]);
});
