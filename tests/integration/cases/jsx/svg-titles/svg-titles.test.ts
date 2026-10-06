// jsx/svg-titles: an SVG `<title>` gives its icon its accessible name, on the server too, when it
// holds several parts (text and interpolations, an absent optional one rendering nothing) or a
// conditional whose branch holds text and an interpolation.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import FileTransfer from "./FileTransfer.uf.tsx";

describeTargets("jsx/svg-titles", () => {
  it("names the icons from every part of their titles", async () => {
    const view = await mountScenario(FileTransfer, "sending");
    await view.expectParity("sending");
    await expect
      .element(view.getByRole("img", { name: "report.pdf: 40% sent. About a minute left" }))
      .toBeVisible();
    await expect.element(view.getByRole("img", { name: "Sending report.pdf" })).toBeVisible();
  });

  it("names the icons without the absent part, from the other branch", async () => {
    const view = await mountScenario(FileTransfer, "paused");
    await view.expectParity("paused");
    await expect.element(view.getByRole("img", { name: "slides.key: 75% sent." })).toBeVisible();
    await expect.element(view.getByRole("img", { name: "Transfer paused" })).toBeVisible();
  });
});
