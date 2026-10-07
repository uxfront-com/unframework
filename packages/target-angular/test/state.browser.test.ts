import FileRowEvents from "virtual:uf-angular-events/events/emit-payloads";
import NarrowingEvents from "virtual:uf-angular-events/probe/Narrowing";
import SeededLetsEvents from "virtual:uf-angular-events/probe/SeededLets";
import DeleteFileEvents from "virtual:uf-angular-events/semantics/deferred-reads";
import SeatPickerEvents from "virtual:uf-angular-events/semantics/derived-consistency";
import StarRatingEvents from "virtual:uf-angular-events/semantics/emit";
import TallyEvents from "virtual:uf-angular-events/semantics/read-after-write";
import FileRow from "virtual:uf-angular/events/emit-payloads";
import Narrowing from "virtual:uf-angular/probe/Narrowing";
import SeededLets from "virtual:uf-angular/probe/SeededLets";
import Sorter from "virtual:uf-angular/probe/Sorter";
import DeleteFile from "virtual:uf-angular/semantics/deferred-reads";
import SeatPicker from "virtual:uf-angular/semantics/derived-consistency";
import StarRating from "virtual:uf-angular/semantics/emit";
import QuantityStepper from "virtual:uf-angular/semantics/props-seed-state";
import Tally from "virtual:uf-angular/semantics/read-after-write";
import WelcomeBanner from "virtual:uf-angular/semantics/setup-once";
// State, derived values and emits as the Angular output runs them in Chromium (ADR-0046, ADR-0047,
// the semantics contract of plan §4.5): the corpus's components, as this target emits them now,
// mounted by the toolchain's adapter. Signals give a read after a write the new value, in the same
// handler, in a function it calls and in another listener of the same event; a `computed` read
// right after a write of what it reads is consistent; state seeded from an input and a setup-once
// constant keep the values they started with across a rerender; each event's payload arrives by its
// shape.
import { afterEach, describe, expect, it } from "vitest";

import { cleanup, render } from "./browser.ts";

afterEach(cleanup);

describe("read after write", () => {
  it("reads each write at once: in the handler, in a function it calls, in a loop", async () => {
    const view = await render(Tally, TallyEvents);
    await view.click("button", "Add two");
    await view.click("button", "Add five");
    await view.click("button", "Count up three");
    await view.click("button", "Add ten");
    expect(view.get('[role="status"]').textContent).toBe("Count: 20");
    expect(view.emitted("total")).toEqual([[2], [7], [20]]);
    expect(view.emitted("steps")).toEqual([[[8, 9, 10]]]);
  });

  it("gives a listener of the same event what the capture listener wrote", async () => {
    const view = await render(Tally, TallyEvents);
    await view.click("button", "Log the phases");
    expect(view.emitted("logged")).toEqual([[["capture", "bubble"]]]);
    expect(view.get("p", "Phases: capture then bubble")).toBeDefined();
  });
});

describe("derived values", () => {
  it("reads a computed consistently right after a write of what it reads", async () => {
    const view = await render(SeatPicker, SeatPickerEvents, { pricePerSeat: 40 });
    await view.click("button", "Add a seat");
    await view.click("button", "Add a group and a guide");
    expect(view.emitted("quote")).toEqual([
      [2, 80, "2 seats for 80"],
      [7, 280, "7 seats for 280, 240 without the guide"],
    ]);
  });
});

describe("setup runs once", () => {
  it("keeps state seeded from an input when the input changes", async () => {
    const view = await render(QuantityStepper, [], { initial: 2, label: "Mugs" });
    await view.click("button");
    await view.rerender({ initial: 10, label: "Cups" });
    expect(view.get("output").textContent).toBe("3");
    expect(view.get("button").getAttribute("aria-label")).toBe("Increase Cups");
    await view.click("button");
    expect(view.get("output").textContent).toBe("4");
  });

  it("keeps a constant that read an input, while the template reads the input anew", async () => {
    const view = await render(WelcomeBanner, [], { name: "Ada" });
    await view.rerender({ name: "Grace" });
    expect(view.get("h2").textContent).toBe("Welcome, Ada");
    expect(view.get("p").textContent).toBe("Signed in as Grace");
  });
});

describe("deferred reads", () => {
  it("reads the latest state and inputs after an await", async () => {
    const view = await render(DeleteFile, DeleteFileEvents, { fileName: "report.pdf" });
    await view.click("button", "Delete");
    await view.click("button", "Add a copy");
    await view.rerender({ fileName: "report-final.pdf" });
    await view.click("button", "Confirm the deletion");
    await expect.poll(() => view.emitted("deleted")).toEqual([["report-final.pdf", 2]]);
    expect(view.get("button", "Delete")).toBeDefined();
  });
});

describe("emits", () => {
  it("gives each event's payload by its shape, in the order the handlers emit", async () => {
    const view = await render(FileRow, FileRowEvents, { path: "docs/readme.md", size: 2048 });
    for (const name of ["Refresh", "Open", "Archive", "Select", "Share", "Share with a note"]) {
      await view.click("button", name);
    }
    expect(view.events).toEqual([
      ["refresh"],
      ["open", "docs/readme.md"],
      ["move", "docs/readme.md", "archive/docs/readme.md"],
      ["refresh"],
      ["pick", { path: "docs/readme.md", size: 2048 }],
      ["share", "docs/readme.md"],
      ["share", "docs/readme.md", "Please review"],
    ]);
  });

  it("emits around writes in one handler, in order, and an event without a payload", async () => {
    const view = await render(StarRating, StarRatingEvents);
    await view.click("button", "3 stars");
    await view.click("button", "Clear");
    expect(view.events).toEqual([
      ["preview", 3],
      ["rate", 3, 0],
      ["preview", 2],
      ["preview", 1],
      ["preview", 0],
      ["cleared"],
    ]);
  });
});

describe("setup `let`s seeded from inputs", () => {
  it("start from the inputs the component was given, and keep those values", async () => {
    const props = { limit: 3, label: "Go", start: 2, note: "n" };
    const view = await render(SeededLets, SeededLetsEvents, props);
    await view.click("button", "Go");
    // From a required input, an optional one with a default, one without, a seeded state and a
    // derived value: none read while the class constructs.
    expect(view.emitted("voted")).toEqual([[2, "Go (3) n 2 4 n", 2, 6]]);
    await view.rerender({ ...props, limit: 10, label: "Again", note: "m" });
    await view.click("button", "Again");
    expect(view.emitted("voted")).toEqual([
      [2, "Go (3) n 2 4 n", 2, 6],
      [1, "Go (3) n 2 4 n", 2, 7],
    ]);
  });

  it("take an optional input's default when it is absent", async () => {
    const view = await render(SeededLets, SeededLetsEvents, { limit: 1 });
    await view.click("button", "Vote");
    expect(view.emitted("voted")).toEqual([[0, "Vote (1) -! 2 8 none", 0, 2]]);
  });
});

describe("functions passed as values", () => {
  it("are there when an initial value calls them, before their declaration", async () => {
    const view = await render(Sorter, []);
    expect(view.get("p").textContent).toBe("Al, Cy");
    await view.click("button", "Add");
    expect(view.get("p").textContent).toBe("Al, Bo, Cy");
  });
});

describe("reads a condition narrows", () => {
  it("run as the source's, only where the condition holds", async () => {
    const rows = [
      { id: 1, name: "Ada", owner: { email: "boss@example.com" } },
      { id: 2, name: "Bo", owner: null },
    ];
    const view = await render(Narrowing, NarrowingEvents, {
      user: { id: 7, name: "Cy", email: "cy@example.com", owner: null },
      rows,
    });
    expect(view.get("p").textContent).toBe("Hello, Cy");
    await view.click("button", "Invite");
    await view.click("button", "Compare Bo");
    await view.click("button", "Ada");
    expect(view.get("output").textContent).toBe("boss@example.com");
    await view.click("button", "Invite");
    await view.click("button", "Compare Bo");
    await view.click("button", "Mail");
    await view.click("button", "Measure");
    expect(view.events).toEqual([
      ["pick", 2],
      ["pick", 1],
      ["pick", 1],
      ["mail", "cy@example.com"],
      ["size", 0],
    ]);
    await view.rerender({ user: undefined, rows });
    expect(view.get("p").textContent).toBe("Hello");
    await view.click("button", "Mail");
    expect(view.emitted("mail")).toEqual([["cy@example.com"]]);
    // 16 for Ada's owner's email, 1 + 2 for the ids, 1; then the bonus of 2 too.
    await view.click("button", "Tally");
    expect(view.get("small").textContent).toBe("20");
    await view.click("button", "Tally");
    expect(view.get("small").textContent).toBe("42");
  });
});
