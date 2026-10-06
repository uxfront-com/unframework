// bindings/nullable-spreads: spreads whose source may be null or undefined where it renders (a
// `T | null` prop, a prop that defaults to `null`, an optional member, `c ? attrs : undefined`
// and list items typed `T | undefined`) render each key of a present source and nothing for an
// absent one, without throwing; a source a condition narrows (`attrs && …`, `!box.inner ? … : …`)
// renders its keys in the branch where it is present.
import { describeTargets, mount, mountScenario } from "@unframework/testing";
import { expect, it } from "vitest";

import ShipmentCard from "./ShipmentCard.uf.tsx";

describeTargets("bindings/nullable-spreads", () => {
  it("renders every key of every present source", async () => {
    const view = await mountScenario(ShipmentCard, "sources-present");
    await view.expectParity("sources-present");
    const carrier = view.getByText("Carrier");
    await expect.element(carrier).toHaveAttribute("id", "carrier");
    await expect.element(carrier).toHaveAttribute("title", "DHL Express");
    await expect
      .element(view.getByText("Estimated delivery"))
      .toHaveAttribute("title", "Tomorrow before noon");
    await expect.element(view.getByText("Parcel 1 of 2")).toHaveAttribute("id", "parcel-tag");
    await expect.element(view.getByText("Live tracking")).toHaveAttribute("id", "tracking");
    const stops = view.getByRole("listitem");
    await expect.element(stops.nth(0)).toHaveAttribute("title", "Leeds depot");
    await expect.element(stops.nth(1)).toHaveAttribute("id", "stop-york");
    await expect.element(stops.nth(1)).not.toHaveAttribute("title");
    await expect
      .element(view.getByText("Signed on delivery"))
      .toHaveAttribute("title", "Signature required");
    await expect.element(view.getByText("Sealed")).toHaveAttribute("id", "parcel-seal");
  });

  it("renders no attribute for an absent source", async () => {
    const view = await mountScenario(ShipmentCard, "sources-absent");
    await view.expectParity("sources-absent");
    const carrier = view.getByText("Carrier");
    await expect.element(carrier).toBeVisible();
    await expect.element(carrier).not.toHaveAttribute("id");
    await expect.element(carrier).not.toHaveAttribute("title");
    await expect.element(view.getByText("Estimated delivery")).not.toHaveAttribute("id");
    await expect.element(view.getByText("Parcel 2 of 2")).not.toHaveAttribute("id");
    await expect.element(view.getByText("Live tracking")).not.toHaveAttribute("id");
    await expect.element(view.getByText("Not sealed")).toBeVisible();
    await expect.element(view.getByText("Signed on delivery")).not.toBeInTheDocument();
    await expect.element(view.getByRole("listitem")).not.toBeInTheDocument();
  });

  // Browser-only: JSON cannot carry `undefined`, in a list or as a prop.
  it("renders nothing for an undefined list item or member and for an explicit null", async () => {
    const view = await mount(ShipmentCard, {
      props: {
        reference: "Shipment GB-2043",
        carrier: { id: "carrier" },
        eta: null,
        parcel: { label: "Parcel 1 of 1", tag: undefined, seal: { id: "parcel-seal" } },
        tracked: true,
        tracking: { id: "tracking" },
        stops: [{ id: "stop-leeds", title: "Leeds depot" }, undefined, { id: "stop-york" }],
        signature: undefined,
      },
    });
    await view.expectParity("undefined-sources");
    const stops = view.getByRole("listitem");
    await expect.element(stops.nth(0)).toHaveAttribute("id", "stop-leeds");
    await expect.element(stops.nth(1)).toHaveTextContent("Stop 2");
    await expect.element(stops.nth(1)).not.toHaveAttribute("id");
    await expect.element(stops.nth(2)).toHaveAttribute("id", "stop-york");
    await expect.element(view.getByText("Carrier")).toHaveAttribute("id", "carrier");
    await expect.element(view.getByText("Estimated delivery")).not.toHaveAttribute("id");
    await expect.element(view.getByText("Parcel 1 of 1")).not.toHaveAttribute("id");
    await expect.element(view.getByText("Sealed")).toHaveAttribute("id", "parcel-seal");
    await expect.element(view.getByText("Signed on delivery")).not.toBeInTheDocument();
  });
});
