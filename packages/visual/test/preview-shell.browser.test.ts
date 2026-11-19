// The preview's shell in Chromium (ADR-0088, ADR-0110): the examples as a tree by category, the
// three landmarks, the keyboard, the theme, and axe-core on the whole page in light and in dark.
// The page is the one `shellPage` writes for a fixture's catalogue, put into this document with
// its scripts run, and its frames are a stub that answers every render.
import { afterEach, describe, expect, it } from "vitest";
import { commands, page, userEvent } from "vitest/browser";

import type { ShellFixture } from "./shell-commands.ts";

const THEME_KEY = "unframework-preview-theme";
const DARK_BACKGROUND = "rgb(22, 23, 27)";
const LIGHT_BACKGROUND = "rgb(255, 255, 255)";

/** Opens a fixture's shell in this document, as a fresh load of the page would. */
async function open(name: ShellFixture, targets?: string[]): Promise<void> {
  const { html } = await commands.ufShellFixture(name, targets);
  const shell = new DOMParser().parseFromString(html, "text/html");
  history.replaceState(null, "", location.pathname + location.search);
  delete document.documentElement.dataset.theme;
  document.head.querySelector("style[data-shell]")?.remove();
  const style = shell.querySelector("style")!;
  style.dataset.shell = "";
  document.head.append(style);
  document.documentElement.lang = shell.documentElement.lang;
  document.body.replaceChildren(...shell.body.childNodes);
  // A parsed script never runs: each runs again as a new element, the head's first, as on a load.
  for (const parsed of [
    ...shell.head.querySelectorAll("script"),
    ...document.body.querySelectorAll("script"),
  ]) {
    if (parsed.type === "application/json") continue;
    const script = document.createElement("script");
    script.textContent = parsed.textContent;
    document.body.append(script);
    if (parsed.isConnected) parsed.remove();
  }
}

/** The names of a tree's or a group's own items, in order. */
function names(list: Element): string[] {
  return [...list.querySelectorAll(":scope > [role='treeitem']")].map((item) => {
    const label = item.getAttribute("aria-labelledby");
    return (label ? document.getElementById(label)! : item).textContent!.trim();
  });
}

/** The group of the item named `name` among a list's own items. */
function group(list: Element, name: string): Element {
  const items = [...list.querySelectorAll(":scope > [role='treeitem']")];
  return items[names(list).indexOf(name)]!.querySelector(":scope > [role='group']")!;
}

const tree = (name: string) => page.getByRole("tree", { name });
const item = (name: string) => page.getByRole("treeitem", { name, exact: true });
const focused = () => document.activeElement;

afterEach(async () => {
  localStorage.removeItem(THEME_KEY);
  await commands.ufShellColorScheme("light");
});

describe("the sidebar", () => {
  it("puts the design system's examples under Examples, and its components apart", async () => {
    await open("design-system");
    const examples = tree("Examples").element();
    expect(examples.getAttribute("role")).toBe("tree");
    expect(names(examples)).toEqual(["Examples"]);
    const top = examples.querySelector(":scope > [role='treeitem']")!;
    expect(top.getAttribute("aria-expanded")).toBe("true");
    expect(names(group(examples, "Examples"))).toEqual(["Buttons", "Card", "Text Field"]);
    expect(names(tree("Components").element())).toEqual([
      "src/Button",
      "src/Card",
      "src/Counter",
      "src/TextField",
    ]);
  });

  it("nests a category's segments, and orders a group's examples by their order", async () => {
    await open("shell-tree");
    const examples = tree("Examples").element();
    expect(names(examples)).toEqual(["A", "Examples"]);
    const a = group(examples, "A");
    expect(names(a)).toEqual(["B", "Top"]);
    // Zeta's order is 1 and Alpha's 2: the order wins over the titles.
    expect(names(group(a, "B"))).toEqual(["Zeta", "Alpha"]);
    expect(names(group(examples, "Examples"))).toEqual(["Plain"]);
    for (const each of examples.querySelectorAll("[role='treeitem']:has(> [role='group'])")) {
      expect(each.getAttribute("aria-expanded")).toBe("true");
    }
    // A fixture with no components shows no empty section for them.
    expect(tree("Components").query()).toBeNull();
  });
});

describe("the layout", () => {
  it("has the sidebar's navigation, the canvas and the controls region", async () => {
    await open("design-system");
    await expect.element(page.getByRole("navigation", { name: "Catalogue" })).toBeVisible();
    await expect.element(page.getByRole("main")).toBeVisible();
    const controls = page.getByRole("region", { name: "Controls" });
    await expect.element(controls).toBeVisible();
    await expect.element(page.getByRole("heading", { level: 1 })).toHaveTextContent("Buttons");
    // A component's props take their controls in the region.
    (item("src/Button").element() as HTMLElement).click();
    await expect.element(controls.getByLabelText("variant")).toBeVisible();
    await expect.element(page.getByRole("heading", { level: 1 })).toHaveTextContent("Button");
    expect(document.querySelectorAll("figure[data-target]")).toHaveLength(7);
    // One target at a time, then all of them again.
    (page.getByRole("radio", { name: "vue" }).element() as HTMLElement).click();
    const shown = () =>
      [...document.querySelectorAll<HTMLElement>("figure[data-target]")]
        .filter((figure) => !figure.hidden)
        .map((figure) => figure.dataset.target);
    expect(shown()).toEqual(["vue"]);
    (page.getByRole("radio", { name: "All" }).element() as HTMLElement).click();
    expect(shown()).toHaveLength(7);
  });

  it("shows one target across the whole canvas, with no Targets switch", async () => {
    await open("design-system", ["react"]);
    const frames = document.querySelector<HTMLElement>(".frames")!;
    const figure = document.querySelector<HTMLElement>("figure[data-target='react']")!;
    expect(document.querySelectorAll("figure[data-target]")).toHaveLength(1);
    // The one-target view from the first paint, not after a click.
    expect(frames.dataset.view).toBe("one");
    expect(page.getByRole("group", { name: "Targets" }).query()).toBeNull();
    expect(page.getByRole("radio").query()).toBeNull();
    // The frame takes the canvas's width and height, less its padding.
    const canvas = frames.getBoundingClientRect();
    const style = getComputedStyle(frames);
    const box = figure.getBoundingClientRect();
    expect(box.width).toBeCloseTo(
      canvas.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      0,
    );
    expect(box.height).toBeCloseTo(
      canvas.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
      0,
    );
  });

  it("opens two or more targets on All", async () => {
    await open("design-system", ["react", "vue"]);
    expect(document.querySelector<HTMLElement>(".frames")!.dataset.view).toBe("all");
    await expect.element(page.getByRole("group", { name: "Targets" })).toBeVisible();
    await expect.element(page.getByRole("radio", { name: "All" })).toBeChecked();
  });

  it("gives each selection its own message in the controls region", async () => {
    await open("design-system");
    const controls = page.getByRole("region", { name: "Controls" });
    const example = "An example takes no props. Select a component to set its props.";
    const component = "This component has no props.";
    await expect.element(controls.getByText(example)).toBeVisible();
    // A component with no props, then an example: the example's message comes back.
    (item("src/Card").element() as HTMLElement).click();
    await expect.element(controls.getByText(component)).toBeVisible();
    (item("Buttons").element() as HTMLElement).click();
    await expect.element(controls.getByText(example)).toBeVisible();
    expect(controls.getByText(component).query()).toBeNull();
    // A component with props shows its form and no message.
    (item("src/Button").element() as HTMLElement).click();
    await expect.element(controls.getByLabelText("variant")).toBeVisible();
    expect(controls.getByText(example).query()?.checkVisibility() ?? false).toBe(false);
    expect(controls.getByText(component).query()).toBeNull();
  });
});

describe("the Open link", () => {
  const TARGETS = ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"];
  const links = () =>
    TARGETS.map((target) =>
      document.querySelector<HTMLAnchorElement>(`figure[data-target="${target}"] figcaption a`),
    );

  it("links each frame's caption to the selected example's own URL on that target", async () => {
    await open("design-system");
    (item("Card").element() as HTMLElement).click();
    for (const [index, link] of links().entries()) {
      const target = TARGETS[index]!;
      expect(link, target).not.toBeNull();
      expect(link!.hidden, target).toBe(false);
      const url = new URL(link!.href);
      // Beside the shell, whatever its path.
      expect(url.origin).toBe(location.origin);
      expect(url.pathname).toBe(new URL("embed.html", location.href).pathname);
      expect([...url.searchParams]).toEqual([
        ["example", "examples/Card"],
        ["target", target],
      ]);
      expect(link!.getAttribute("href")).toMatch(/^embed\.html\?/);
      expect(link!.target).toBe("_blank");
      expect(link!.rel).toBe("noopener");
      expect(link!.textContent).toBe("Open");
      await expect
        .element(page.getByRole("link", { name: `Open Card on ${target} in a new tab` }))
        .toBeVisible();
    }
    // Another example moves every link with it.
    (item("Buttons").element() as HTMLElement).click();
    expect(links().map((link) => new URL(link!.href).searchParams.get("example"))).toEqual(
      TARGETS.map(() => "examples/Buttons"),
    );
    await expect
      .element(page.getByRole("link", { name: "Open Buttons on vue in a new tab" }))
      .toBeVisible();
    // A component takes props, which no URL holds: no caption links it.
    (item("src/Button").element() as HTMLElement).click();
    for (const link of links()) expect(link!.checkVisibility()).toBe(false);
    expect(page.getByRole("link").query()).toBeNull();
    // An example again brings them back.
    (item("Card").element() as HTMLElement).click();
    for (const link of links()) expect(link!.checkVisibility()).toBe(true);
  });

  it("keeps each caption on one line in the grid's narrowest cell", async () => {
    await open("design-system");
    const grid = document.querySelector<HTMLElement>(".frames")!;
    // The cells at their minimum width, 20rem, as in a window just wide enough for one.
    grid.style.gridTemplateColumns = "repeat(auto-fill, 20rem)";
    for (const target of TARGETS) {
      const caption = document.querySelector(`figure[data-target="${target}"] figcaption`)!;
      await expect.element(caption.querySelector("output")!).toHaveTextContent("rendered");
      const [label, link, status] = [...caption.children].map((each) =>
        each.getBoundingClientRect(),
      );
      // One line: the three share a top and a height, the line's own.
      expect(link!.top, target).toBeCloseTo(label!.top, 0);
      expect(status!.top, target).toBeCloseTo(label!.top, 0);
      expect(link!.height, target).toBeCloseTo(label!.height, 0);
      expect(status!.height, target).toBeCloseTo(label!.height, 0);
      // The link follows the name, and the status keeps the end.
      expect(link!.left, target).toBeGreaterThan(label!.right);
      expect(status!.left, target).toBeGreaterThan(link!.right);
    }
  });

  for (const scheme of ["light", "dark"] as const) {
    it(`has no axe violations in ${scheme} with an example's links shown`, async () => {
      await commands.ufShellColorScheme(scheme);
      await open("design-system");
      await expect
        .element(page.getByRole("link", { name: "Open Buttons on vue in a new tab" }))
        .toBeVisible();
      await expect.element(document.body).toHaveNoAxeViolations();
    });
  }
});

describe("the keyboard", () => {
  it("focuses the filter on /, and drives the tree with the arrows and Enter", async () => {
    await open("shell-tree");
    const filter = page.getByRole("searchbox", { name: "Filter examples and components" });
    await userEvent.keyboard("/");
    await expect.element(filter).toHaveFocus();
    await userEvent.keyboard("zet");
    // Zeta, and the groups it sits in.
    const shown = [...document.querySelectorAll<HTMLElement>("[role='treeitem']")].filter((each) =>
      each.checkVisibility(),
    );
    expect(shown).toEqual([item("A").element(), item("B").element(), item("Zeta").element()]);
    await expect.element(item("Zeta")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(filter).toHaveValue("");
    await expect.element(item("Plain")).toBeVisible();

    // Down from the filter enters the tree, at its first item.
    await userEvent.keyboard("{ArrowDown}");
    expect(focused()).toBe(item("A").element());
    await userEvent.keyboard("{ArrowDown}");
    expect(focused()).toBe(item("B").element());
    // Right on an open group goes to its first child.
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()).toBe(item("Zeta").element());
    await userEvent.keyboard("{ArrowDown}");
    expect(focused()).toBe(item("Alpha").element());
    await userEvent.keyboard("{Enter}");
    await expect.element(item("Alpha")).toHaveAttribute("aria-selected", "true");
    await expect.element(page.getByRole("heading", { level: 1 })).toHaveTextContent("Alpha");
    expect(location.hash).toBe("#example:examples/Alpha");
    // Left on a child goes to its group, and left again closes it.
    await userEvent.keyboard("{ArrowLeft}");
    expect(focused()).toBe(item("B").element());
    await userEvent.keyboard("{ArrowLeft}");
    await expect.element(item("B")).toHaveAttribute("aria-expanded", "false");
    // A closed group's children are skipped.
    await userEvent.keyboard("{ArrowDown}");
    expect(focused()).toBe(item("Top").element());
    await userEvent.keyboard("{End}");
    expect(focused()).toBe(item("Plain").element());
    await userEvent.keyboard("{Home}");
    expect(focused()).toBe(item("A").element());
    // The tree is one tab stop: the item with focus last.
    const stops = [...tree("Examples").element().querySelectorAll<HTMLElement>("[tabindex='0']")];
    expect(stops).toEqual([item("A").element()]);

    // ? lists the shortcuts, and Escape closes the list.
    await userEvent.keyboard("?");
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect.element(dialog).toBeVisible();
    await userEvent.keyboard("{Escape}");
    expect(document.querySelector("dialog")!.open).toBe(false);
  });
});

describe("the theme", () => {
  it("follows the system's colour scheme", async () => {
    await commands.ufShellColorScheme("dark");
    await open("design-system");
    const toggle = page.getByRole("button", { name: "Dark theme" });
    await expect.element(toggle).toHaveAttribute("aria-pressed", "true");
    expect(getComputedStyle(document.body).backgroundColor).toBe(DARK_BACKGROUND);
    await commands.ufShellColorScheme("light");
    await expect.element(toggle).toHaveAttribute("aria-pressed", "false");
    expect(getComputedStyle(document.body).backgroundColor).toBe(LIGHT_BACKGROUND);
  });

  it("keeps the reader's choice over the system's, across a load", async () => {
    await open("design-system");
    const toggle = page.getByRole("button", { name: "Dark theme" });
    await expect.element(toggle).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(toggle);
    await expect.element(toggle).toHaveAttribute("aria-pressed", "true");
    expect(getComputedStyle(document.body).backgroundColor).toBe(DARK_BACKGROUND);
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");

    await open("design-system");
    expect(document.documentElement.dataset.theme).toBe("dark");
    await expect.element(toggle).toHaveAttribute("aria-pressed", "true");
    expect(getComputedStyle(document.body).backgroundColor).toBe(DARK_BACKGROUND);
    // The system's scheme no longer decides.
    await commands.ufShellColorScheme("dark");
    await commands.ufShellColorScheme("light");
    expect(getComputedStyle(document.body).backgroundColor).toBe(DARK_BACKGROUND);
  });

  for (const scheme of ["light", "dark"] as const) {
    it(`has no axe violations in ${scheme}`, async () => {
      await commands.ufShellColorScheme(scheme);
      await open("design-system");
      // A component, so the controls region holds its form.
      (item("src/Button").element() as HTMLElement).click();
      await expect.element(page.getByLabelText("variant")).toBeVisible();
      await expect.element(document.body).toHaveNoAxeViolations();
    });
  }
});
