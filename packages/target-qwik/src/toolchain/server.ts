import { renderToString as renderQwik } from "@qwik.dev/core/server";
import type { SsrRenderer } from "@unframework/codegen";

import { asComponent } from "./component.ts";
import { CONTAINER_TAG, componentHtml } from "./container.ts";
import { withProps } from "./element.ts";

/**
 * Renders a compiled Qwik component on the server (layer L6) and returns only its HTML. It
 * renders into a fragment container, without the loader or the preloader, then drops the
 * container and the data Qwik appends to it. Nothing in the component's HTML is masked: Qwik's
 * attributes (`:`, `q:*`, `q-e:*`) are left to normalisation, and the random `q:instance` is on
 * the container, so two renders give the same HTML. The props arrive as a parent's written
 * attributes deliver them, `null` included (./element.ts).
 */
export const renderToString: SsrRenderer = async (component, options) => {
  const result = await renderQwik(withProps(asComponent(component), options.props ?? {}), {
    containerTagName: CONTAINER_TAG,
    qwikLoader: "never",
    preloader: false,
  });
  return componentHtml(result.html);
};
