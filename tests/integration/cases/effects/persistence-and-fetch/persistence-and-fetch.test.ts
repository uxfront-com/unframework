// effects/persistence-and-fetch: the browser's own APIs in client code, as an app uses them. A
// watcher writes the chosen shelf to `localStorage`; a search watcher builds its URL with
// `URLSearchParams`, fetches it with an `AbortController` that its `onCleanup` aborts when a later
// key overtakes it, and drops the cancelled reply; a `watchEffect` hands a named function to
// `setInterval` and keeps the handle in a setup `let` that its `onCleanup` clears, and runs again
// only when it is switched, not on the ticks (the named function's reads are not the effect's);
// and a handler awaits `Promise.all(shelves.map(countShelf))` over a local async function. No
// request leaves the page: each test that fetches puts a fake `fetch` on `window`, which answers
// after 100 ms of the view's clock, so every reply lands in a `tick` step on every target.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import ReadingList from "./ReadingList.uf.tsx";

const SHELF_KEY = "reading-list:shelf";

const CATALOGUE: Record<string, string[]> = {
  all: ["Dubliners", "Dune", "Emma", "SPQR", "The Guns of August"],
  Fiction: ["Dubliners", "Dune", "Emma"],
  History: ["SPQR", "The Guns of August"],
};

/**
 * Replaces `window.fetch` with a fake server until `restore()`: it answers a search with the
 * catalogue's books that start with the query, and a shelf with its books, after 100 ms of the
 * view's clock (an interval the clock fires once), or rejects as `fetch` does when the request's
 * signal aborts first.
 */
function fakeNetwork() {
  const aborted: string[] = [];
  const real = window.fetch;
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const href = input instanceof Request ? input.url : input.toString();
    const url = new URL(href, window.location.origin);
    const answer =
      url.pathname === "/api/books"
        ? (CATALOGUE[url.searchParams.get("shelf") ?? "all"] ?? []).filter((book) =>
            book.toLowerCase().startsWith((url.searchParams.get("q") ?? "").toLowerCase()),
          )
        : (CATALOGUE[url.searchParams.get("name") ?? ""] ?? []);
    return new Promise<Response>((resolve, reject) => {
      const timer = setInterval(() => {
        clearInterval(timer);
        resolve({ ok: true, json: () => Promise.resolve(answer) } as Response);
      }, 100);
      init?.signal?.addEventListener("abort", () => {
        clearInterval(timer);
        aborted.push(href);
        reject(new DOMException("The request was aborted.", "AbortError"));
      });
    });
  }) as typeof window.fetch;
  return {
    aborted,
    restore: () => {
      window.fetch = real;
    },
  };
}

describeTargets("effects/persistence-and-fetch", () => {
  it("renders the empty list", async () => {
    const view = await mountScenario(ReadingList, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("0 found");
    await expect.element(view.getByText("Fiction: not counted")).toBeVisible();
  });

  it(
    "searches as the reader types, and drops the request a later key overtakes",
    { requires: ["interactivity"] },
    async () => {
      const network = fakeNetwork();
      try {
        const view = await mountScenario(ReadingList, "initial", { clock: true });
        await view.user.type(view.getByRole("searchbox", { name: "Search" }), "d");
        await view.user.keyboard("u");
        await view.expectParity("searching");
        await expect.element(view.getByRole("status")).toHaveTextContent("Searching");
        expect(view.emitted("requested")).toEqual([
          ["/api/books?q=d&shelf=all"],
          ["/api/books?q=du&shelf=all"],
        ]);
        expect(view.emitted("cancelled")).toEqual([["d"]]);
        expect(network.aborted).toEqual(["/api/books?q=d&shelf=all"]);
        await view.clock.tick(100);
        await view.expectParity("found");
        await expect.element(view.getByRole("status")).toHaveTextContent("2 found");
        const books = view.getByRole("list", { name: "Books" }).getByRole("listitem");
        expect(books.elements().map((book) => book.textContent)).toEqual(["Dubliners", "Dune"]);
        expect(view.emitted("found")).toEqual([["du", 2]]);
        expect(view.emitted("cancelled")).toEqual([["d"]]);
      } finally {
        network.restore();
      }
    },
  );

  it("remembers the shelf in localStorage", { requires: ["interactivity"] }, async () => {
    localStorage.removeItem(SHELF_KEY);
    const view = await mountScenario(ReadingList, "initial");
    await view.user.click(view.getByRole("button", { name: "Unread" }));
    await view.expectParity("unread-shelf");
    await expect
      .element(view.getByRole("button", { name: "Unread" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem(SHELF_KEY)).toBe("unread");
    await view.user.click(view.getByRole("button", { name: "All" }));
    await view.expectParity("all-shelf");
    await expect
      .element(view.getByRole("button", { name: "All" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem(SHELF_KEY)).toBe("all");
    localStorage.removeItem(SHELF_KEY);
  });

  it(
    "checks every second while switched on, and stops when switched off",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(ReadingList, "initial", { clock: true });
      const check = view.getByRole("button", { name: "Check for new books" });
      await view.user.click(check);
      await view.expectParity("checking");
      await expect.element(check).toHaveAttribute("aria-pressed", "true");
      expect(view.emitted("started")).toEqual([[]]);
      expect(view.emitted("checked")).toEqual([]);
      await view.clock.tick(2000);
      await view.expectParity("checked-twice");
      await expect.element(view.getByText("Checks: 2")).toBeVisible();
      expect(view.emitted("checked")).toEqual([[1], [2]]);
      // The tick reads no state the effect tracks: the effect does not run again.
      expect(view.emitted("started")).toEqual([[]]);
      await view.user.click(check);
      await view.clock.tick(2000);
      await view.expectParity("switched-off");
      await expect.element(check).toHaveAttribute("aria-pressed", "false");
      await expect.element(view.getByText("Checks: 2")).toBeVisible();
      expect(view.emitted("checked")).toEqual([[1], [2]]);
      expect(view.emitted("started")).toEqual([[]]);
    },
  );

  it("stops checking once unmounted", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(ReadingList, "initial", { clock: true });
    await view.user.click(view.getByRole("button", { name: "Check for new books" }));
    await view.clock.tick(1000);
    await view.expectParity("checked-once");
    await expect.element(view.getByText("Checks: 1")).toBeVisible();
    expect(view.emitted("checked")).toEqual([[1]]);
    await view.unmount();
    // Three more seconds: the check's interval was cleared with the component.
    await view.clock.tick(3000);
    expect(view.emitted("checked")).toEqual([[1]]);
  });

  it(
    "counts every shelf at once, and reports when all are counted",
    { requires: ["interactivity"] },
    async () => {
      const network = fakeNetwork();
      try {
        const view = await mountScenario(ReadingList, "initial", { clock: true });
        await view.user.click(view.getByRole("button", { name: "Refresh shelves" }));
        await view.expectParity("refreshing");
        await expect.element(view.getByText("Refreshing")).toBeVisible();
        expect(view.emitted("refreshed")).toEqual([]);
        await view.clock.tick(100);
        await view.expectParity("refreshed");
        await expect.element(view.getByText("Fiction: 3")).toBeVisible();
        await expect.element(view.getByText("History: 2")).toBeVisible();
        await expect.element(view.getByText("Up to date")).toBeVisible();
        expect(view.emitted("refreshed")).toEqual([[5]]);
        expect(network.aborted).toEqual([]);
      } finally {
        network.restore();
      }
    },
  );
});
