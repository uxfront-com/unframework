// sourcemaps/computed-throws: an error a computed throws names its authored line (L14, ADR-0078).
// In the browser a refund makes the total negative. On the server, `case.json`'s `ssrThrows` props
// make the first render throw, which is how Astro, with no client code, checks it too. The markup
// reads the state in the same expression as the computed: Qwik stores a computed's error and
// doesn't re-run a reader of only that computed, so only a reader that the state's change re-runs
// throws there (ADR-0078).
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import InvoiceTotal from "./InvoiceTotal.uf.tsx";

describeTargets("sourcemaps/computed-throws", () => {
  it("renders the total", async () => {
    const view = await mountScenario(InvoiceTotal, "two-units");
    await view.expectParity("two-units");
    await expect.element(view.getByRole("status")).toHaveTextContent("10 after 0 refunded");
  });

  it("maps the computed's throw to its line", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(InvoiceTotal, "two-units");
    const button = view.getByRole("button", { name: "Refund" });
    await expect.element(button).toBeVisible();
    await view.expectThrown(() => view.user.click(button));
  });
});
