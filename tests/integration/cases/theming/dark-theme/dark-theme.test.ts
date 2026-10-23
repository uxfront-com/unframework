// theming/dark-theme: the dark colour scheme (plan §7.6, ADR-0061, ADR-0064). The case opts into
// `prefers-color-scheme: dark`, under which Styleframe's stylesheet gives the tokens their dark
// values.
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Note from "./Note.uf.tsx";

describeTargets("theming/dark-theme", () => {
  it("renders the dark tokens", async () => {
    const view = await mountScenario(Note, "default");
    await view.expectParity("default");
    await expect.element(view.getByText("Dark by preference.")).toBeVisible();
  });
});
