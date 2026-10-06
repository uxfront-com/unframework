// control-flow/narrowing: each branch reads what its condition tests (an optional member through
// `&&`, `?:` and `!`, a chain that splits at `!member`, nested `&&`, a list item that may be null,
// `uptime !== undefined`, `typeof storage` and a plan's `kind`), and renders when, and only when,
// the test holds. A zero uptime and a zero storage are values, not absences.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import AccountSummary from "./AccountSummary.uf.tsx";

describeTargets("control-flow/narrowing", () => {
  it("renders the loading branch and the absent member's branches", async () => {
    const view = await mountScenario(AccountSummary, "loading");
    await view.expectParity("loading");
    await expect.element(view.getByText("Loading the account")).toBeVisible();
    await expect.element(view.getByText("Role: guest")).toBeVisible();
    await expect.element(view.getByText("No profile")).toBeVisible();
    await expect.element(view.getByText("Storage unlimited")).toBeVisible();
    await expect.element(view.getByText("Trial ends in 12 days")).toBeVisible();
    await expect.element(view.getByRole("heading")).not.toBeInTheDocument();
    await expect.element(view.getByText("Signed in as", { exact: false })).not.toBeInTheDocument();
    await expect.element(view.getByText("Uptime", { exact: false })).not.toBeInTheDocument();
    await expect.element(view.getByRole("listitem")).not.toBeInTheDocument();
  });

  it("renders the branch after the !member test, and a zero storage as a number", async () => {
    const view = await mountScenario(AccountSummary, "signed-out");
    await view.expectParity("signed-out");
    await expect.element(view.getByText("Signed out")).toBeVisible();
    await expect.element(view.getByText("Role: guest")).toBeVisible();
    await expect.element(view.getByText("Storage 0.0 GB")).toBeVisible();
    await expect.element(view.getByText("Renews on 1 November 2026")).toBeVisible();
    await expect.element(view.getByRole("listitem")).toHaveTextContent("Vacant");
    await expect.element(view.getByText("Loading the account")).not.toBeInTheDocument();
  });

  it("renders every branch that reads the member, its team and the other values", async () => {
    const view = await mountScenario(AccountSummary, "administrator");
    await view.expectParity("administrator");
    await expect.element(view.getByRole("heading", { name: "Ada Lovelace" })).toBeVisible();
    await expect.element(view.getByText("Signed in as ada@example.com")).toBeVisible();
    await expect.element(view.getByText("Role: administrator")).toBeVisible();
    await expect.element(view.getByText("Profile of Ada Lovelace")).toBeVisible();
    await expect.element(view.getByText("Team: Analytical Engines")).toBeVisible();
    await expect.element(view.getByText("Uptime 99.5%")).toBeVisible();
    await expect.element(view.getByText("Storage 12.5 GB")).toBeVisible();
    await expect.element(view.getByText("Renews on 1 November 2026")).toBeVisible();
    const seats = view.getByRole("listitem");
    await expect.element(seats.nth(0)).toHaveTextContent("Ada Lovelace");
    await expect.element(seats.nth(1)).toHaveTextContent("Vacant");
  });

  it("renders nothing for an absent team, and a zero uptime", async () => {
    const view = await mountScenario(AccountSummary, "member-without-team");
    await view.expectParity("member-without-team");
    await expect.element(view.getByRole("heading", { name: "Grace Hopper" })).toBeVisible();
    await expect.element(view.getByText("Role: member")).toBeVisible();
    await expect.element(view.getByText("Uptime 0.0%")).toBeVisible();
    await expect.element(view.getByText("Storage unlimited")).toBeVisible();
    await expect.element(view.getByText("Trial ends in 3 days")).toBeVisible();
    const seats = view.getByRole("listitem");
    await expect.element(seats.nth(0)).toHaveTextContent("Vacant");
    await expect.element(seats.nth(1)).toHaveTextContent("Grace Hopper");
    await expect.element(view.getByText("Team:", { exact: false })).not.toBeInTheDocument();
  });
});
