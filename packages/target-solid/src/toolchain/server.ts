// The Solid SSR renderer (Node, inside the `ssr:solid` project).
import type { SsrRenderer } from "@unframework/codegen";
import { createComponent, renderToStringAsync } from "solid-js/web";

import { asComponent } from "./component.ts";

/**
 * Renders with `renderToStringAsync`, which waits for async data like a server would. Solid
 * renders only when the component is compiled for the server (`generate: "ssr"`) and
 * `solid-js/web` resolves to its server build; vite-plugin-solid arranges both only with
 * `ssr: true`, which the toolchain's `ssr` Vite config sets. Otherwise Solid's browser build
 * answers with `undefined` and carries on, so that fails here.
 */
export const renderToString: SsrRenderer = async (component, options) => {
  const solidComponent = asComponent(component);
  const html: unknown = await renderToStringAsync(() =>
    createComponent(solidComponent, { ...options.props }),
  );
  if (typeof html !== "string") {
    throw new Error(
      `Solid's server render returned ${typeof html}, not HTML: solid-js/web resolved to its browser build. Compile with vite-plugin-solid({ ssr: true }).`,
    );
  }
  return html;
};
