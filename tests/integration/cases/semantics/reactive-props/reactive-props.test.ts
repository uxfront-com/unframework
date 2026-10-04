// semantics/reactive-props: rendering again with new props updates text, attributes, the class,
// the style, the branch and the list; a prop the new props leave out is absent again. Lists are
// checked for content and order only: M1 does not guarantee DOM identity on reorder (ADR-0036).
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import UploadStatus from "./UploadStatus.uf.tsx";

describeTargets("semantics/reactive-props", () => {
  it("renders the first props", async () => {
    const view = await mountScenario(UploadStatus, "queued");
    await view.expectParity("queued");
    await expect.element(view.getByRole("heading", { name: "report.pdf" })).toBeVisible();
    await expect.element(view.getByText("Waiting to start")).toBeVisible();
    await expect
      .element(view.getByRole("progressbar", { name: "Upload progress" }))
      .toHaveAttribute("aria-valuenow", "0");
  });

  // Browser-only: a rerender has no server twin.
  it("updates text, attributes, class, style, branch and list on a rerender", async () => {
    const view = await mountScenario(UploadStatus, "queued");
    await view.rerender({
      fileName: "report.pdf",
      state: "failed",
      percent: 45,
      steps: [
        { id: "verify", label: "Verify checksum" },
        { id: "send", label: "Send chunks" },
      ],
      error: "The network connection was lost.",
    });
    await view.expectParity("failed-after-rerender");
    await expect.element(view.getByText("The network connection was lost.")).toBeVisible();
    await expect
      .element(view.getByRole("region", { name: "Upload of report.pdf" }))
      .toHaveClass("upload upload-failed", { exact: true });
    await expect
      .element(view.getByRole("region", { name: "Upload of report.pdf" }))
      .toHaveStyle("color: rgb(138, 28, 28)");
    await expect
      .element(view.getByRole("progressbar", { name: "Upload progress" }))
      .toHaveAttribute("aria-valuenow", "45");
    await expect.element(view.getByRole("listitem").nth(0)).toHaveTextContent("Verify checksum");
    await expect.element(view.getByRole("listitem").nth(1)).toHaveTextContent("Send chunks");
  });

  // Browser-only: a rerender has no server twin.
  it("leaves out a prop the new props no longer give", async () => {
    const view = await mountScenario(UploadStatus, "queued");
    await view.rerender({
      fileName: "report.pdf",
      state: "failed",
      percent: 45,
      steps: [{ id: "send", label: "Send chunks" }],
      error: "The network connection was lost.",
    });
    await view.rerender({
      fileName: "report-v2.pdf",
      state: "uploading",
      percent: 80,
      steps: [
        { id: "send", label: "Send chunks" },
        { id: "verify", label: "Verify checksum" },
        { id: "index", label: "Index the text" },
      ],
    });
    await view.expectParity("uploading-after-rerender");
    await expect.element(view.getByRole("heading", { name: "report-v2.pdf" })).toBeVisible();
    await expect.element(view.getByText("Uploading")).toBeVisible();
    await expect.element(view.getByRole("listitem").nth(0)).toHaveTextContent("Send chunks");
    await expect.element(view.getByRole("listitem").nth(2)).toHaveTextContent("Index the text");
  });
});
