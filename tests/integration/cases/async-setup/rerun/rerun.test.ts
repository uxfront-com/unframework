// async-setup/rerun: the setup runs again on the client (ADR-0101). The mounted hook after the
// await focuses the input through its template ref and emits the awaited name: in the hydrate
// projects that emit is the client's setup having run again.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Note from "./Note.uf.tsx";

describeTargets("async-setup/rerun", () => {
  it("renders the awaited name and the provided tone", async () => {
    const view = await mountScenario(Note, "ada");
    await view.expectParity("ada");
    await expect.element(view.getByRole("textbox", { name: "Note for User ada" })).toBeVisible();
    await expect.element(view.getByText("Tone: calm")).toBeVisible();
  });

  it(
    "focuses and emits once the setup resolves",
    { requires: ["interactivity"] },
    async () => {
      const view = await mountScenario(Note, "ada");
      await view.expectParity("mounted");
      await expect
        .element(view.getByRole("textbox", { name: "Note for User ada" }))
        .toHaveFocus();
      expect(view.emitted("ready")).toEqual([["User ada"]]);
    },
  );
});
