// jsx/whitespace: significant whitespace written as string-literal children (`{" "}` between
// elements, edge spaces, `{"\n"}` in the middle of a `pre`, tabs and line breaks) and text beside
// expressions renders exactly, on every target.
import { describeTargets, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import ShippingLabel from "./ShippingLabel.uf.tsx";

describeTargets("jsx/whitespace", () => {
  it("keeps every significant space and line break", async () => {
    const view = await mountScenario(ShippingLabel, "label");
    await view.expectParity("label");
    await expect.element(view.getByText("To: Ada Lovelace")).toBeVisible();
    await expect
      .element(view.getByText("London SW1Y 4JH United Kingdom"))
      .toHaveTextContent("London SW1Y 4JH United Kingdom", { normalizeWhitespace: false });
    await expect
      .element(view.getByText("Handle with care"))
      .toHaveTextContent("  Handle with care ", { normalizeWhitespace: false });
    await expect
      .element(view.getByText("Ada Lovelace 12 St James's Square London SW1Y 4JH"))
      .toHaveTextContent("Ada Lovelace\n12 St James's Square\nLondon  SW1Y 4JH", {
        normalizeWhitespace: false,
      });
    await expect
      .element(view.getByText("Parcel: 1 of 2 Weight: 2.5 kg"))
      .toHaveTextContent("Parcel:\t1 of 2\nWeight:\t2.5 kg", { normalizeWhitespace: false });
    await expect
      .element(view.getByText("Sent by Unframework Ltd, on two lines."))
      .toHaveTextContent("Sent by Unframework Ltd, on two\nlines.", { normalizeWhitespace: false });
  });

  it("keeps the edge spaces of interpolated values", async () => {
    const view = await mountScenario(ShippingLabel, "padded-values");
    await view.expectParity("padded-values");
    await expect
      .element(view.getByText("To: Grace Hopper"))
      .toHaveTextContent("To:  Grace Hopper ", { normalizeWhitespace: false });
    await expect
      .element(view.getByText("Grace Hopper 1 Navy Way Arlington VA 22202"))
      .toHaveTextContent(" Grace Hopper \n1 Navy Way\nArlington  VA 22202", {
        normalizeWhitespace: false,
      });
  });
});
