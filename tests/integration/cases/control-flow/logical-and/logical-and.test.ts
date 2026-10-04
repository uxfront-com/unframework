// control-flow/logical-and: `cond && <el/>` renders by truthiness, so a falsy number (0) or
// string ("") renders nothing, never the value itself; chained conditions too.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import InboxSummary from "./InboxSummary.uf.tsx";

describeTargets("control-flow/logical-and", () => {
  it("renders nothing for 0 and the empty string", async () => {
    const view = await mountScenario(InboxSummary, "all-falsy");
    await view.expectParity("all-falsy");
    await expect.element(view.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expect
      .element(view.getByRole("region", { name: "Inbox summary" }))
      .toHaveTextContent("Inbox");
  });

  it("renders every branch for truthy values", async () => {
    const view = await mountScenario(InboxSummary, "all-truthy");
    await view.expectParity("all-truthy");
    await expect.element(view.getByRole("heading", { name: "Work" })).toBeVisible();
    await expect.element(view.getByText("3 unread")).toBeVisible();
    await expect.element(view.getByText("1 flagged")).toBeVisible();
    await expect.element(view.getByText("Some unread messages are flagged.")).toBeVisible();
    await expect.element(view.getByText("Filed under Work")).toBeVisible();
    await expect.element(view.getByText("Ada")).toBeVisible();
  });

  it("renders a truthy number beside a zero one", async () => {
    const view = await mountScenario(InboxSummary, "unread-only");
    await view.expectParity("unread-only");
    await expect.element(view.getByText("2 unread")).toBeVisible();
    await expect.element(view.getByText("Filed under Personal")).toBeVisible();
    await expect.element(view.getByText("flagged", { exact: false })).not.toBeInTheDocument();
  });
});
