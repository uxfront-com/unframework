// events/guard-controls: `preventDefault()` and `stopPropagation()` act exactly where the source
// calls them, after a guard that returns early. Enter sends a comment and adds a tag (through a
// helper) without a line break or a form submission, and every other key still types; a test
// that casts the event's target stops a code at four characters, and lets Escape clear a search
// before it closes the panel; a click on a tip or a backdrop itself (`event.target ===
// event.currentTarget`) hides it and goes no further, while a click inside reaches the page. Two
// listeners of one click run in their order: one that returns early beside a `once` one, and an
// async one beside a `once` one, which runs before the async one resumes.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import CommentComposer from "./CommentComposer.uf.tsx";

describeTargets("events/guard-controls", () => {
  it("renders the composer", async () => {
    const view = await mountScenario(CommentComposer, "initial");
    await view.expectParity("initial");
    await expect.element(view.getByRole("textbox", { name: "Comment" })).toBeVisible();
    await expect.element(view.getByRole("dialog", { name: "Discard draft" })).toBeVisible();
  });

  it("sends on Enter, and lets every other key type", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(CommentComposer, "initial");
    await view.user.type(view.getByRole("textbox", { name: "Comment" }), "Hi");
    await view.user.keyboard("{Enter}");
    await view.expectParity("comment-sent");
    await expect.element(view.getByRole("textbox", { name: "Comment" })).toHaveValue("Hi");
    expect(view.emitted("sent")).toEqual([["Hi"]]);
    await view.user.keyboard("!");
    await view.expectParity("comment-typed");
    await expect.element(view.getByRole("textbox", { name: "Comment" })).toHaveValue("Hi!");
  });

  it(
    "adds a tag on Enter through a helper, without submitting the form",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(CommentComposer, "initial");
      await view.user.type(view.getByRole("textbox", { name: "Tag" }), "vue{Enter}");
      await view.expectParity("tag-added");
      await expect.element(view.getByRole("textbox", { name: "Tag" })).toHaveValue("");
      await expect
        .element(view.getByRole("list", { name: "Tag list" }).getByRole("listitem"))
        .toHaveTextContent("vue");
      expect(view.getByRole("list", { name: "Log" }).getByRole("listitem").elements()).toEqual([]);
      await view.user.click(view.getByRole("button", { name: "Save tags" }));
      await view.expectParity("tags-submitted");
      await expect
        .element(view.getByRole("list", { name: "Log" }).getByRole("listitem"))
        .toHaveTextContent("tags submitted");
    },
  );

  it("stops the code at four characters", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(CommentComposer, "initial");
    await view.user.type(view.getByRole("textbox", { name: "Code" }), "123456");
    await view.expectParity("code-full");
    await expect.element(view.getByRole("textbox", { name: "Code" })).toHaveValue("1234");
  });

  it(
    "clears the search on Escape, and closes the panel on the next Escape",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(CommentComposer, "initial");
      await view.user.type(view.getByRole("textbox", { name: "Search" }), "ab");
      await view.expectParity("search-typed");
      await expect.element(view.getByText("Searching for: ab")).toBeVisible();
      await view.user.keyboard("{Escape}");
      await view.expectParity("search-cleared");
      await expect.element(view.getByRole("textbox", { name: "Search" })).toHaveValue("");
      await expect.element(view.getByText("Searching for:")).toBeVisible();
      await view.user.keyboard("{Escape}");
      await view.expectParity("panel-closed");
      await expect.element(view.getByText("Panel closed")).toBeVisible();
    },
  );

  it(
    "hides the tip on a click on the tip itself, and lets a click inside reach the page",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(CommentComposer, "initial");
      await view.user.click(view.getByRole("button", { name: "More tips" }));
      await view.expectParity("tip-button");
      const log = view.getByRole("list", { name: "Log" }).getByRole("listitem");
      expect(log.elements().map((line) => line.textContent)).toEqual(["tip button", "page"]);
      await view.user.click(view.getByText("Click here to hide this tip.", { exact: false }), {
        position: { x: 4, y: 4 },
      });
      await view.expectParity("tip-hidden");
      await expect.element(view.getByRole("button", { name: "Keep" })).toBeVisible();
      expect(log.elements().map((line) => line.textContent)).toEqual(["tip button", "page"]);
      expect(view.getByText("Click here to hide this tip.", { exact: false }).elements()).toEqual(
        [],
      );
    },
  );

  it(
    "dismisses the dialog on a click on the backdrop itself, and lets a click inside reach the page",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(CommentComposer, "initial");
      await view.user.click(view.getByText("Discard this draft?"));
      await view.user.click(view.getByRole("button", { name: "Keep" }));
      await view.expectParity("dialog-kept");
      const log = view.getByRole("list", { name: "Log" }).getByRole("listitem");
      expect(log.elements().map((line) => line.textContent)).toEqual(["page", "kept", "page"]);
      await view.user.click(view.getByTestId("backdrop"), {
        position: { x: 4, y: 4 },
      });
      await view.expectParity("dialog-dismissed");
      await expect.element(view.getByText("Draft dismissed")).toBeVisible();
      expect(log.elements().map((line) => line.textContent)).toEqual([
        "page",
        "kept",
        "page",
        "dismissed",
      ]);
    },
  );

  it(
    "saves only with a tag, and reports the first click alone",
    { requires: ["interactivity", "event-once"] },
    async () => {
      const view = await mountScenario(CommentComposer, "initial");
      await view.user.click(view.getByRole("button", { name: "Save", exact: true }));
      await view.expectParity("saved-empty");
      await expect.element(view.getByRole("button", { name: "Save", exact: true })).toBeVisible();
      expect(view.emitted("firstSave")).toEqual([[]]);
      expect(view.emitted("saved")).toEqual([]);
      await view.user.type(view.getByRole("textbox", { name: "Tag" }), "vue{Enter}");
      await view.expectParity("tagged");
      await expect
        .element(view.getByRole("list", { name: "Tag list" }).getByRole("listitem"))
        .toHaveTextContent("vue");
      await view.user.click(view.getByRole("button", { name: "Save", exact: true }));
      await view.expectParity("saved-tagged");
      await expect.element(view.getByRole("button", { name: "Save", exact: true })).toBeVisible();
      expect(view.emitted("saved")).toEqual([[1]]);
      expect(view.emitted("firstSave")).toEqual([[]]);
    },
  );

  it(
    "runs a once listener in the click, before the async listener beside it resumes",
    { requires: ["interactivity", "event-once"] },
    async () => {
      const view = await mountScenario(CommentComposer, "initial");
      await view.user.click(view.getByRole("button", { name: "Upload", exact: true }));
      await view.expectParity("upload-started");
      const log = view.getByRole("list", { name: "Log" }).getByRole("listitem");
      expect(log.elements().map((line) => line.textContent)).toEqual([
        "upload started",
        "first upload",
      ]);
      await view.user.click(view.getByRole("button", { name: "Finish upload" }));
      await view.expectParity("upload-finished");
      await expect.element(view.getByRole("button", { name: "Upload", exact: true })).toBeVisible();
      await view.user.click(view.getByRole("button", { name: "Upload", exact: true }));
      await view.user.click(view.getByRole("button", { name: "Finish upload" }));
      await view.expectParity("uploaded-twice");
      expect(log.elements().map((line) => line.textContent)).toEqual([
        "upload started",
        "first upload",
        "upload finished",
        "upload started",
        "upload finished",
      ]);
    },
  );
});
