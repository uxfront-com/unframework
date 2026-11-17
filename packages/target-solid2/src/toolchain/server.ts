// The Solid 2 SSR renderer (Node, inside the `ssr:solid2` project).
import type { HydrationRenderer, SsrRenderer } from "@unframework.dev/codegen";
import { createComponent } from "solid-js";
import { renderToStream } from "@solidjs/web";

import { asComponent } from "./component.ts";
import { assertSolid2 } from "./guard.ts";

assertSolid2();

/**
 * Renders with `renderToStream`, which, awaited, gives the fully settled HTML: it waits for async
 * data like a server would (ADR-0101). Solid renders only when the component is compiled for the
 * server and `@solidjs/web` resolves to its server build; @solidjs/vite-plugin arranges both only
 * with `ssr: true`, which the toolchain's `ssr` Vite config sets. Otherwise the result is no
 * string, which fails here.
 *
 * `noScripts` leaves out the hydration and serialization scripts, which the HTML comparison (L6)
 * would see. Without that data, hydration runs the setup again on the client, as the semantics
 * contract asks.
 */
export const renderToString: SsrRenderer = async (component, options) => {
  const solidComponent = asComponent(component);
  const html: unknown = await renderToStream(
    () => createComponent(solidComponent, { ...options.props }),
    { noScripts: true },
  );
  if (typeof html !== "string") {
    throw new Error(
      `Solid's server render returned ${typeof html}, not HTML: @solidjs/web resolved to its browser build. Compile with @solidjs/vite-plugin({ ssr: true }).`,
    );
  }
  return html;
};

/**
 * Renders the server HTML the hydrate adapter hydrates (L12, ADR-0095): the same render, which
 * the toolchain's `hydrate` configuration compiles hydratable, so every element carries the
 * hydration key `hydrate` reads. The hydration script is left out: the adapter puts its record on
 * the page itself.
 */
export const renderForHydration: HydrationRenderer = renderToString;
