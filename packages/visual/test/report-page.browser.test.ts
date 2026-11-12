// `report.html` in Chromium: the grid, the diff overlay by keyboard, the delta table, the cells that
// left fewer files, and axe-core on the whole page. The page is the one `renderReport` wrote to
// `.output/<fixture>/`, put into this document with its images served from beside it.
import { describe, expect, it } from "vitest";
import { commands, page, userEvent } from "vitest/browser";

import type { ReportFixture } from "./report-commands.ts";

/** Opens a fixture's page in this document, and waits for every image it shows to load. */
async function open(name: ReportFixture): Promise<void> {
  const { html, base } = await commands.ufReportFixture(name);
  const report = new DOMParser().parseFromString(html, "text/html");
  // The page's paths are relative to its own directory, which this document is not in.
  for (const element of report.querySelectorAll("[src], [href]")) {
    for (const attribute of ["src", "href"]) {
      const value = element.getAttribute(attribute);
      if (value !== null && !value.startsWith("#")) element.setAttribute(attribute, `${base}${value}`);
    }
  }
  document.head.querySelector("style[data-report]")?.remove();
  const style = report.querySelector("style")!;
  style.dataset.report = "";
  document.head.append(style);
  document.documentElement.lang = report.documentElement.lang;
  document.title = report.title;
  document.body.replaceChildren(...report.body.childNodes);
  await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
}

/** The list of an example's cells. */
function grid(example: string) {
  return page.getByRole("list", { name: `${example} on each target` });
}

const TARGETS = ["vue", "react", "svelte", "solid", "angular", "qwik", "astro"];

describe("a run with one failed cell", () => {
  it("shows seven labelled cells for each example, in the run's order", async () => {
    await open("report-failed");
    await expect
      .element(page.getByRole("heading", { level: 1 }))
      .toHaveTextContent("Visual report ✗ Failed");
    await expect.element(page.getByText("1 of 14 cells failed", { exact: false })).toBeVisible();
    for (const example of ["examples/Buttons", "examples/Card"]) {
      // Seven up: one row of seven columns on a desktop window.
      const columns = getComputedStyle(grid(example).element()).gridTemplateColumns.split(" ");
      expect(columns).toHaveLength(7);
      const cells = grid(example).getByRole("listitem").elements();
      expect(cells.map((cell) => cell.querySelector(".target")?.textContent)).toEqual(TARGETS);
      for (const cell of cells) {
        const failed = example === "examples/Card" && cell.dataset.target === "react";
        expect(cell.querySelector(".status")?.textContent?.trim()).toBe(
          failed ? "✗ Failed" : "✓ Passed",
        );
        const image = cell.querySelector("img")!;
        expect(image.alt).toBe(`${example} on ${cell.dataset.target}`);
        expect(image.naturalWidth).toBeGreaterThan(0);
      }
    }
    expect(grid("examples/Card").getByText("reference").elements()).toHaveLength(1);
  });

  it("switches the overlay between the reference, the actual capture and the diff by keyboard", async () => {
    await open("report-failed");
    const failure = page.getByRole("region", { name: /examples\/Card on react/ });
    const visible = () =>
      [...failure.element().querySelectorAll<HTMLImageElement>(".stack img")]
        .filter((image) => getComputedStyle(image).visibility === "visible")
        .map((image) => image.dataset.view);
    const diff = failure.getByRole("radio", { name: "Diff" });
    await expect.element(diff).toBeChecked();
    expect(visible()).toEqual(["diff"]);

    // The arrows move the checked radio, as in any radio group (Tab reaches it, below).
    (diff.element() as HTMLInputElement).focus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect.element(failure.getByRole("radio", { name: "Actual" })).toBeChecked();
    expect(visible()).toEqual(["actual"]);
    await userEvent.keyboard("{ArrowLeft}");
    await expect.element(failure.getByRole("radio", { name: "Reference" })).toBeChecked();
    expect(visible()).toEqual(["reference"]);
    for (const image of failure.element().querySelectorAll<HTMLImageElement>(".stack img")) {
      expect(image.naturalWidth).toBeGreaterThan(0);
    }
  });

  it("lists every geometry delta with its node, property and values", async () => {
    await open("report-failed");
    const table = page.getByRole("table", { name: "Geometry deltas: 3" });
    const rows = [...table.element().querySelectorAll("tbody tr")].map((row) =>
      [...row.querySelectorAll("td")].map((cell) => cell.textContent),
    );
    const node = "div[0] > div[1] > button[0]";
    expect(rows).toEqual([
      [
        node,
        "box",
        JSON.stringify({ x: 20, y: 70, width: 64, height: 24 }),
        JSON.stringify({ x: 20, y: 70, width: 72, height: 28 }),
      ],
      [node, "padding-left", "12px", "16px"],
      [node, "padding-top", "4px", "6px"],
    ]);
  });

  it("reaches every control by keyboard, in the page's order", async () => {
    await open("report-failed");
    const controls = [
      ...document.querySelectorAll<HTMLElement>("a[href], input:checked, [tabindex='0']"),
    ];
    expect(controls.length).toBeGreaterThan(14);
    document.body.focus();
    const reached: Element[] = [];
    for (let step = 0; step < controls.length; step += 1) {
      await userEvent.tab();
      reached.push(document.activeElement!);
    }
    expect(reached).toEqual(controls);
    // The delta table scrolls on a narrow screen, so its region takes focus to scroll by keyboard.
    expect(reached).toContain(document.querySelector(".deltas"));
  });

  it("fits a phone's width, and still passes axe-core there", async () => {
    await page.viewport(390, 844);
    try {
      await open("report-failed");
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(innerWidth);
      const columns = getComputedStyle(grid("examples/Card").element()).gridTemplateColumns;
      expect(columns.split(" ").length).toBeLessThan(7);
      await expect.element(page.elementLocator(document.body)).toHaveNoAxeViolations();
    } finally {
      await page.viewport(1280, 800);
    }
  });

  it("passes axe-core", async () => {
    await open("report-failed");
    expect(document.documentElement.lang).toBe("en");
    expect(document.title).toBe("Visual report: failed");
    await expect.element(page.elementLocator(document.body)).toHaveNoAxeViolations();
  });
});

describe("a run whose cells left fewer files", () => {
  it("shows a cell for each target that ran, and says which files are missing", async () => {
    await open("report-missing");
    const cells = grid("examples/Badge").getByRole("listitem").elements();
    expect(cells.map((cell) => cell.dataset.target)).toEqual(["vue", "react", "svelte"]);

    // missing-artefact: the actual capture and its geometry, and no reference or diff to show.
    const vue = page.getByRole("region", { name: /examples\/Badge on vue/ });
    expect(
      vue
        .getByRole("radio")
        .elements()
        .map((radio) => radio.parentElement?.textContent),
    ).toEqual(["Actual"]);
    await expect.element(vue.getByRole("radio", { name: "Actual" })).toBeChecked();
    await expect.element(vue.getByText("The run left no reference.png or diff.png.")).toBeVisible();

    // not-captured: no image at all, so no overlay, and the grid says so.
    expect(cells[1]!.querySelector("img")).toBeNull();
    expect(cells[1]!.textContent).toContain("No capture");
    const react = page.getByRole("region", { name: /examples\/Badge on react/ });
    expect(react.getByRole("radio").elements()).toHaveLength(0);
    await expect.element(react.getByText("The run left no image for this cell.")).toBeVisible();

    // test-failed: its capture matched, and its test failed after.
    const svelte = page.getByRole("region", { name: /examples\/Badge on svelte/ });
    await expect.element(svelte.getByText(/unexpected console\.error/)).toBeVisible();
    await expect.element(svelte.getByText("No geometry or computed-style delta.")).toBeVisible();
    await expect
      .element(
        svelte.getByText("The run left only the capture in the grid, and no comparison files."),
      )
      .toBeVisible();

    // Every image the page shows is one the run wrote.
    for (const image of document.images) expect(image.naturalWidth).toBeGreaterThan(0);
  });

  it("passes axe-core", async () => {
    await open("report-missing");
    await expect.element(page.elementLocator(document.body)).toHaveNoAxeViolations();
  });
});
