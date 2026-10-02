// The Astro SSR renderer, run inside the `ssr` test project, whose Vite config is Astro's own
// pipeline: there `import X from "./X.uf.tsx"` yields the compiled Astro component, and this
// module's `astro/container` import shares the component's copy of the Astro runtime.
import type { SsrRenderer } from "@unframework/codegen";
import { experimental_AstroContainer as AstroContainer } from "astro/container";

import { isAstroComponentFactory } from "./protocol.ts";

let container: Promise<AstroContainer> | undefined;

/**
 * Renders with the Container API. The default `partial: true` gives the component's HTML alone:
 * no doctype, and no `<style>` (the component is not imported with `?container`).
 */
export const renderToString: SsrRenderer = async (component, options) => {
  if (!isAstroComponentFactory(component)) {
    throw new TypeError("Astro renderToString: expected a compiled Astro component.");
  }
  container ??= AstroContainer.create();
  return (await container).renderToString(component, { props: { ...options.props } });
};
