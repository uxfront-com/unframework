// The renderer on the SSR projects' configuration (the `ssr` project of vitest.config.ts), as
// the ssr:angular project runs it: the component compiled by the toolchain's ngtsc plugin in the
// Vite server, and Angular's packages linked as they load, so this worker never loads Angular's
// compiler, and the order in which the component and the renderer load cannot matter (the
// harness loads the component first).
import type { SsrRenderer } from "@unframework/codegen";
import { describe, expect, it } from "vitest";

describe("the server renderer", () => {
  it("renders a component that imports @angular/common, loaded before the renderer", async () => {
    const { default: Outlet } = (await import("./fixtures/Outlet.uf.tsx.ts")) as {
      default: unknown;
    };
    const { renderToString } = (await import("../src/toolchain/server.ts")) as {
      renderToString: SsrRenderer;
    };
    expect(await renderToString(Outlet, {})).toMatch(
      /^<uf-outlet style="display: contents;">(?:<!--[^>]*-->)*<p>x<\/p>(?:<!--[^>]*-->)*<\/uf-outlet>$/,
    );
    // Ahead of time only: @angular/compiler registers its JIT facade globally when it loads.
    expect(Reflect.get(globalThis, "ng")?.ɵcompilerFacade).toBeUndefined();
  });
});
