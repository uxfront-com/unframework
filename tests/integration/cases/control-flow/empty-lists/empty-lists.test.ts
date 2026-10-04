// control-flow/empty-lists: an empty list renders an empty element beside a "nothing here"
// branch; an optional list prop defaults to an empty array.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import MessageList from "./MessageList.uf.tsx";

describeTargets("control-flow/empty-lists", () => {
  it("renders both empty lists with their placeholders", async () => {
    const view = await mountScenario(MessageList, "empty");
    await view.expectParity("empty");
    await expect.element(view.getByText("Nothing here yet.")).toBeVisible();
    await expect.element(view.getByText("No archived messages.")).toBeVisible();
    await expect.element(view.getByRole("listitem")).not.toBeInTheDocument();
  });

  it("renders an empty inbox beside a filled archive", async () => {
    const view = await mountScenario(MessageList, "archive-only");
    await view.expectParity("archive-only");
    await expect.element(view.getByText("All caught up")).toBeVisible();
    await expect.element(view.getByRole("listitem")).toHaveTextContent("Old invoice");
    await expect.element(view.getByText("1 archived")).toBeVisible();
  });

  it("renders the messages instead of the placeholder", async () => {
    const view = await mountScenario(MessageList, "two-messages");
    await view.expectParity("two-messages");
    await expect.element(view.getByText("Welcome aboard")).toBeVisible();
    await expect.element(view.getByText("Your order has shipped")).toBeVisible();
    await expect.element(view.getByText("No archived messages.")).toBeVisible();
  });
});
