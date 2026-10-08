// state/narrowed-reads: everyday reads that a test for null, undefined or truthiness narrows,
// written as Vue developers write them. A selected member is emitted whole under `if
// (selected.value)` and copied to a local after a guard; a computed reads an optional prop's
// member under a ternary; a draft's optional email is emitted under a test of the member; a timer
// handle is cleared with no test at all. A handler shown only while `page.value < pageCount.value`
// writes the page and emits it: the emit sees the new page. Switching from a password to a link
// renders a text field where the password field was: it starts empty.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import TeamInvite from "./TeamInvite.uf.tsx";

describeTargets("state/narrowed-reads", () => {
  it("renders the first page for the inviter", async () => {
    const view = await mountScenario(TeamInvite, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("heading", { name: "Invite as Ada" })).toBeVisible();
    await expect.element(view.getByText("Page 1 of 2")).toBeVisible();
    await expect.element(view.getByRole("status")).toHaveTextContent("Nobody selected");
  });

  it("greets a guest", async () => {
    const view = await mountScenario(TeamInvite, "guest");
    await view.expectParity("guest");
    await expect.element(view.getByRole("heading", { name: "Invite as a guest" })).toBeVisible();
    await expect.element(view.getByText("Page 1 of 1")).toBeVisible();
  });

  it(
    "invites the selected member, and removes the selection",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(TeamInvite, "initial");
      await view.user.click(view.getByRole("button", { name: "Invite" }));
      await view.user.click(view.getByRole("button", { name: "Remove" }));
      await view.expectParity("nobody-invited");
      await expect.element(view.getByRole("status")).toHaveTextContent("Nobody selected");
      expect(view.events()).toEqual([]);
      await view.user.click(view.getByRole("button", { name: "Grace" }));
      await view.user.click(view.getByRole("button", { name: "Invite" }));
      await view.expectParity("invited");
      await expect.element(view.getByRole("status")).toHaveTextContent("Selected: Grace");
      await expect
        .element(view.getByRole("button", { name: "Grace" }))
        .toHaveAttribute("aria-pressed", "true");
      expect(view.emitted("select")).toEqual([[{ id: 1, name: "Grace" }]]);
      await view.user.click(view.getByRole("button", { name: "Remove" }));
      await view.expectParity("removed");
      await expect.element(view.getByRole("status")).toHaveTextContent("Nobody selected");
      expect(view.emitted("removed")).toEqual([["Grace"]]);
    },
  );

  it(
    "pages forward and back, emitting the page it moved to",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(TeamInvite, "initial");
      await view.user.click(view.getByRole("button", { name: "Next" }));
      await view.expectParity("second-page");
      await expect.element(view.getByText("Page 2 of 2")).toBeVisible();
      await expect.element(view.getByRole("button", { name: "Barbara" })).toBeVisible();
      expect(view.emitted("moved")).toEqual([[2]]);
      await view.user.click(view.getByRole("button", { name: "Previous" }));
      await view.expectParity("first-page");
      await expect.element(view.getByText("Page 1 of 2")).toBeVisible();
      expect(view.emitted("moved")).toEqual([[2], [1]]);
    },
  );

  it("sends the typed email, and tags the draft", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(TeamInvite, "initial");
    await view.user.click(view.getByRole("button", { name: "Send" }));
    await view.expectParity("sent-empty");
    await expect.element(view.getByRole("textbox", { name: "Email", exact: true })).toHaveValue("");
    expect(view.emitted("submitted")).toEqual([]);
    await view.user.type(
      view.getByRole("textbox", { name: "Email", exact: true }),
      "ada@example.com",
    );
    await view.user.click(view.getByRole("button", { name: "Send" }));
    await view.expectParity("sent");
    await expect
      .element(view.getByRole("textbox", { name: "Email", exact: true }))
      .toHaveValue("ada@example.com");
    expect(view.emitted("submitted")).toEqual([["ada@example.com"]]);
    await view.user.click(view.getByRole("button", { name: "Tag as team" }));
    await view.user.click(view.getByRole("button", { name: "Tag as team" }));
    await view.expectParity("tagged");
    await expect.element(view.getByRole("button", { name: "Tag as team" })).toBeVisible();
    expect(view.emitted("tagged")).toEqual([[1], [2]]);
  });

  it(
    "switches from a password to a link without carrying the typed password",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(TeamInvite, "initial");
      await view.user.fill(view.getByLabelText("Password", { exact: true }), "hunter2");
      await view.expectParity("password-typed");
      await expect.element(view.getByLabelText("Password", { exact: true })).toHaveValue("hunter2");
      await view.user.click(view.getByRole("button", { name: "Use a link" }));
      await view.expectParity("link");
      await expect.element(view.getByRole("textbox", { name: "Sign-in email" })).toHaveValue("");
      await expect.element(view.getByText("We send you a link.")).toBeVisible();
      await view.user.click(view.getByRole("button", { name: "Use a password" }));
      await view.expectParity("password-again");
      await expect.element(view.getByLabelText("Password", { exact: true })).toHaveValue("");
    },
  );

  it("restarts and stops the clock", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(TeamInvite, "initial", { clock: true });
    await view.user.click(view.getByRole("button", { name: "Start the clock" }));
    await view.clock.tick(2000);
    await view.expectParity("counting");
    await expect.element(view.getByText("Seconds: 2")).toBeVisible();
    // A restart clears the running interval before it starts another.
    await view.user.click(view.getByRole("button", { name: "Start the clock" }));
    await view.clock.tick(1000);
    await view.expectParity("restarted");
    await expect.element(view.getByText("Seconds: 3")).toBeVisible();
    await view.user.click(view.getByRole("button", { name: "Stop the clock" }));
    await view.clock.tick(2000);
    await view.expectParity("stopped");
    await expect.element(view.getByText("Seconds: 3")).toBeVisible();
  });
});
