// The spec-facing matchers the setup file registers (ADR-0085): `toHaveNoAxeViolations` judges as
// L11 does, `toHaveAriaTree` compares the tree L7 snapshots, and Vitest's own ARIA snapshot
// matchers stay Vitest's. A failing matcher is awaited through `rejects`, so its message is checked
// and the test itself passes.
import { expect } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets, it, mount } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

const PIXEL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='8' height='8' fill='%23345'/%3E%3C/svg%3E";
const IMAGE = `<img src="${PIXEL}" width="8" height="8">`;

describeTargets("stub/matchers", () => {
  it("toHaveNoAxeViolations passes on an element axe finds nothing wrong with", async () => {
    const view = await mount({ html: "<button>Save</button>" });
    await expect.element(view.getByRole("button")).toHaveNoAxeViolations();
  });

  it("toHaveNoAxeViolations fails with each rule axe reports, and where", async () => {
    const view = await mount({ html: `<p>${IMAGE}</p>` });
    const paragraph = view.container.querySelector("p")!;
    await expect(expect(paragraph).toHaveNoAxeViolations()).rejects.toThrow(
      /^axe-core reported violations on dom:\n {2}image-alt \(critical\): .* at img$/,
    );
  });

  it("toHaveNoAxeViolations fails through expect.element too", async () => {
    const view = await mount({ html: `<p>${IMAGE}</p>` });
    // The matcher is retried until the poll's timeout: a short one keeps the test fast.
    await expect(
      expect.element(view.locator, { timeout: 100 }).toHaveNoAxeViolations(),
    ).rejects.toThrow(/image-alt \(critical\)/);
  });

  it("toHaveNoAxeViolations passes when axe reports exactly the expected rules", async () => {
    const view = await mount({ html: `<p>${IMAGE}</p>` });
    await expect.element(view.locator).toHaveNoAxeViolations({ expected: ["image-alt"] });
  });

  it("toHaveNoAxeViolations fails when an expected rule is not reported", async () => {
    const view = await mount({ html: `<p><img src="${PIXEL}" width="8" height="8" alt="A"></p>` });
    await expect(
      expect(view.container).toHaveNoAxeViolations({ expected: ["image-alt"] }),
    ).rejects.toThrow(
      /^axe-core reported violations on dom:\n {2}expected but not reported: image-alt$/,
    );
  });

  it("toHaveAriaTree passes on the tree, written indented in a template literal", async () => {
    const view = await mount({
      html: `<div role="group" aria-label="Actions"><button>Save</button><button>Cancel</button></div>`,
    });
    await expect.element(view.getByRole("group")).toHaveAriaTree(`
      - group "Actions":
        - button "Save"
        - button "Cancel"
    `);
  });

  it("toHaveAriaTree reads a generated id as L7 does, the same on every target", async () => {
    // Vue's form of `useId()`: the tree holds the id as L7's normalised DOM renames it.
    const view = await mount({
      html: `<nav><a href="#uf-id-v-0">Jump</a></nav><p id="uf-id-v-0">Target</p>`,
    });
    await expect.element(view.getByRole("navigation")).toHaveAriaTree(`
      - navigation:
        - link "Jump":
          - /url: "#uf-id-1"
    `);
  });

  it("toHaveAriaTree fails with a diff of the trees", async () => {
    const view = await mount({
      html: `<div role="group" aria-label="Actions"><button>Save</button></div>`,
    });
    const group = view.container.querySelector("div")!;
    await expect(
      expect(group).toHaveAriaTree(`
        - group "Actions":
          - button "Cancel"
      `),
    ).rejects.toThrow(
      'the ARIA tree on dom differs:\n- expected\n+ actual\n  - group "Actions":\n-   - button "Cancel"\n+   - button "Save"',
    );
  });

  it("toHaveAriaTree takes an element only", async () => {
    await expect(expect("- button").toHaveAriaTree("- button")).rejects.toThrow(
      "toHaveAriaTree: expected an element, as `expect.element(locator)` resolves one, but received string.",
    );
  });

  it("leaves Vitest's own toMatchAriaInlineSnapshot as Vitest's", async () => {
    const view = await mount({ html: "<button>Save</button>" });
    await expect.element(view.getByRole("button")).toMatchAriaInlineSnapshot(`- button "Save"`);
  });
});
