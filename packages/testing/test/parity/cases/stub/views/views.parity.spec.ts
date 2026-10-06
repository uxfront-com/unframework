// The View's props: `mountScenario` mounts with one of case.json's SSR scenarios, so the browser
// and the server render the same props, and `rerender` replaces the props whole, as a parent
// that renders the component again does (L8, ADR-0043).
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets, mount, mountScenario } from "../../../../../src/index.ts";
import type { StubComponent } from "../../../dom-target.ts";
import "../../../dom-target.ts";

/** A stub with two props, each with a default. */
const badge: StubComponent = {
  html: ({ name = "world", tone = "info" }) =>
    `<p class="${String(tone)}">Hello, ${String(name)}!</p>`,
};

describeTargets("stub/views", () => {
  it("mounts with an SSR scenario's props", async () => {
    const view = await mountScenario(badge, "named");
    await expect.element(view.getByText("Hello, Ada!")).toHaveClass("warn");
    const bare = await mountScenario(badge, "bare");
    await expect.element(bare.getByText("Hello, world!")).toHaveClass("info");
  });

  it("refuses a scenario case.json does not declare, naming those it does", async () => {
    await expect(mountScenario(badge, "absent")).rejects.toThrow(
      `mountScenario(…, "absent"): stub/views's case.json declares no SSR scenario "absent" (it declares named, bare).`,
    );
  });

  it("rerenders with new props, replacing them whole", async () => {
    const view = await mount(badge, { props: { name: "Ada", tone: "warn" } });
    await view.rerender({ name: "Bo" });
    // `tone` is absent now, so it takes its default again.
    await expect.element(view.getByText("Hello, Bo!")).toHaveClass("info");
    await view.rerender({});
    await expect.element(view.getByText("Hello, world!")).toBeVisible();
    expect(view.html()).toBe('<p class="info">\n  "Hello, world!"\n</p>\n');
  });

  it("refuses props that are not an object, and a rerender after the unmount", async () => {
    await expect(mount(badge, { props: [] as never })).rejects.toThrow(
      "mount: props are an object of prop names and values, not an array.",
    );
    const view = await mount(badge);
    await expect(view.rerender(null as never)).rejects.toThrow(/not null/);
    await view.unmount();
    await expect(view.rerender({})).rejects.toThrow("rerender: the view is unmounted.");
  });
});
