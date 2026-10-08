// slots/forwarding: a frame passes its title and default slots on to a box (ADR-0054's
// forwarding). Forwarding keeps presence: where the gallery fills nothing, the box shows its own
// fallback.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Gallery from "./Gallery.uf.tsx";

describeTargets("slots/forwarding", () => {
  it("renders the forwarded fills and the fallbacks", async () => {
    const view = await mount(Gallery);
    await view.expectParity("initial");
    await expect
      .element(view.getByRole("region", { name: "Filled" }))
      .toHaveTextContent("SunsetTaken at dusk.");
    await expect
      .element(view.getByRole("region", { name: "Empty" }))
      .toHaveTextContent("UntitledNo content");
  });
});
