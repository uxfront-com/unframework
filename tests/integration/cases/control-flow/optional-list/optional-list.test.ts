// control-flow/optional-list: lists whose source may be absent, written `(items ?? []).map(…)`
// (an optional array, and one that may be null), render their items when there are some and
// nothing when the source is absent. In the `<pre>`, the line feed after a conditional that can
// render nothing comes after the text that starts the `<pre>`, so every server keeps it.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import BuildLog from "./BuildLog.uf.tsx";

describeTargets("control-flow/optional-list", () => {
  it("renders the lines and the warnings when both lists are given", async () => {
    const view = await mountScenario(BuildLog, "passed");
    await view.expectParity("passed");
    await expect
      .element(view.getByText("$ make build", { exact: false }))
      .toHaveTextContent("$ make build\ncc -O2 -c main.c\nld -o app main.o\n", {
        normalizeWhitespace: false,
      });
    await expect
      .element(view.getByRole("list", { name: "Warnings" }))
      .toHaveTextContent("main.c: unused variable 'tmp'");
    await expect.element(view.getByText("(failed)")).not.toBeInTheDocument();
  });

  it("renders nothing for a null list and an absent one", async () => {
    const view = await mountScenario(BuildLog, "failed-without-output");
    await view.expectParity("failed-without-output");
    await expect
      .element(view.getByText("$ make test", { exact: false }))
      .toHaveTextContent("$ make test (failed)\n", { normalizeWhitespace: false });
    await expect.element(view.getByText("(failed)")).toBeVisible();
    await expect.element(view.getByRole("listitem")).not.toBeInTheDocument();
  });

  it("keeps the line feed when the conditional before it renders nothing", async () => {
    const view = await mountScenario(BuildLog, "no-output-yet");
    await view.expectParity("no-output-yet");
    await expect
      .element(view.getByText("$ make install"))
      .toHaveTextContent("$ make install\n", { normalizeWhitespace: false });
    await expect.element(view.getByRole("listitem")).not.toBeInTheDocument();
  });
});
