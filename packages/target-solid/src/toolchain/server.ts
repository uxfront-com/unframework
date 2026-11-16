// The Solid SSR renderer (Node, inside the `ssr:solid` project).
import type { HydrationRenderer, SsrRenderer } from "@unframework.dev/codegen";
import { createComponent, renderToStringAsync } from "solid-js/web";

import { asComponent } from "./component.ts";

/**
 * The server render's options. `solid-js/web` resolves its types to the browser build's
 * (`web/types/server-mock.d.ts`), which leave out `noScripts`; the server build reads it
 * (`web/dist/server.js`, `renderToStream`), and its own types declare it (`web/types/server.d.ts`).
 */
const SERVER_OPTIONS: NonNullable<Parameters<typeof renderToStringAsync>[1]> & {
  noScripts: boolean;
} = { noScripts: true };

/**
 * Renders with `renderToStringAsync`, which waits for async data like a server would. Solid
 * renders only when the component is compiled for the server (`generate: "ssr"`) and
 * `solid-js/web` resolves to its server build; vite-plugin-solid arranges both only with
 * `ssr: true`, which the toolchain's `ssr` Vite config sets. Otherwise Solid's browser build
 * answers with `undefined` and carries on, so that fails here.
 *
 * `noScripts` leaves out the `<script>` that carries an async setup's resource data (ADR-0101),
 * which the HTML comparison (L6) would see; a component without a resource serializes nothing,
 * so its HTML is the same. Without that data, hydration runs the setup again on the client, as
 * the semantics contract asks.
 */
export const renderToString: SsrRenderer = async (component, options) => {
  const solidComponent = asComponent(component);
  const html: unknown = await renderToStringAsync(
    () => createComponent(solidComponent, { ...options.props }),
    SERVER_OPTIONS,
  );
  if (typeof html !== "string") {
    throw new Error(
      `Solid's server render returned ${typeof html}, not HTML: solid-js/web resolved to its browser build. Compile with vite-plugin-solid({ ssr: true }).`,
    );
  }
  return html;
};

/**
 * Renders the server HTML the hydrate adapter hydrates (L12, ADR-0095): the same render, which
 * the toolchain's `hydrate` configuration compiles hydratable, so every element carries the
 * `data-hk` key `hydrate` reads. The hydration script is left out: the adapter puts its record on
 * the page itself.
 */
export const renderForHydration: HydrationRenderer = renderToString;
