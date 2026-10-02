import { afterAll, describe, expect, it } from "vitest";

import { renderToString } from "../src/toolchain/server.ts";
import { loadAstroComponent, scratchDirectory } from "./astro.ts";

const scratch = scratchDirectory("server");
afterAll(() => scratch.remove());

describe("the Astro SSR renderer", () => {
  it("returns only the component's HTML, with its props", async () => {
    const component = await loadAstroComponent(
      scratch.path,
      '---\nconst { name = "world" } = Astro.props;\n---\n\n<p class="greeting">Hello, {name}!</p>\n',
    );
    await expect(renderToString(component, {})).resolves.toBe(
      '<p class="greeting">Hello, world!</p>',
    );
    await expect(renderToString(component, { props: { name: "Astro" } })).resolves.toBe(
      '<p class="greeting">Hello, Astro!</p>',
    );
  });

  it("rejects with the component's error", async () => {
    const component = await loadAstroComponent(
      scratch.path,
      '---\nthrow new Error("boom");\n---\n\n<p>never</p>\n',
    );
    await expect(renderToString(component, {})).rejects.toThrow("boom");
  });

  it("rejects anything that is not a compiled Astro component", async () => {
    await expect(renderToString(() => "<p>x</p>", {})).rejects.toThrow(
      "expected a compiled Astro component",
    );
    await expect(
      renderToString({ __ufTarget: "astro", id: "/a/X.uf.tsx.astro", name: "X" }, {}),
    ).rejects.toThrow("expected a compiled Astro component");
  });
});
