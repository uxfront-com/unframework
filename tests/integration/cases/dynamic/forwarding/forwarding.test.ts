// dynamic/forwarding: a frame passes its title slot on through `<component is>` (ADR-0054's
// forwarding), to whichever child its prop chooses. Forwarding keeps presence: where the gallery
// fills nothing, the child shows its own fallback.
import { describeTargets, it, mount } from "@unframework/testing";
import { expect } from "vitest";

import Gallery from "./Gallery.uf.tsx";

describeTargets("dynamic/forwarding", () => {
  it("renders the forwarded fills and the fallback", async () => {
    const view = await mount(Gallery);
    await view.expectParity("initial");
    await expect
      .element(view.getByRole("region", { name: "Card" }).getByRole("heading", { level: 3 }))
      .toHaveTextContent("Sunset");
    await expect
      .element(view.getByRole("region", { name: "Panel" }).getByRole("heading", { level: 4 }))
      .toHaveTextContent("Dawn");
    await expect
      .element(view.getByRole("region", { name: "Empty" }).getByRole("heading", { level: 4 }))
      .toHaveTextContent("Untitled");
  });
});
