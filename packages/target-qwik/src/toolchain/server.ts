import { createSignal } from "@qwik.dev/core";
import { renderToString as renderQwik } from "@qwik.dev/core/server";
import type { HydrationRenderer, SsrRenderer } from "@unframework.dev/codegen";

import { asComponent } from "./component.ts";
import { CONTAINER_TAG, componentHtml } from "./container.ts";
import { withProps } from "./element.ts";
import { resumedListenerQrl } from "./listener.qwik.ts";
import { ResumeHost } from "./resume-host.qwik.ts";
import type { ResumeState } from "./resume-host.qwik.ts";

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

/** The views this module has rendered for resumption: each one's listeners are its own. */
let views = 0;

/**
 * Renders the server HTML the hydrate adapter resumes (L12, ADR-0095): the whole container, its
 * state, vnode data, sync functions and event registrations included, with the component inside
 * the resume host (./resume-host.qwik.ts), and each of the test's listeners as a QRL that calls
 * the one the page registers (./listener.qwik.ts). Each QRL's segment URL is the one the page's
 * Vite development server serves it at: a segment beside its module, `/@fs/<module>_<symbol>.js`,
 * and Qwik's own handlers at `/@qwik-handlers`.
 */
export const renderForHydration: HydrationRenderer = async (component, options) => {
  const view = `uf-resumed-${(views += 1)}`;
  const listeners = Object.fromEntries(
    Object.keys(options.on ?? {}).map((name) => [
      `on${name.charAt(0).toUpperCase()}${name.slice(1)}$`,
      resumedListenerQrl(view, name),
    ]),
  );
  const state = createSignal<ResumeState>({
    props: { ...options.props, ...listeners },
    key: view,
    mounted: true,
  });
  const result = await renderQwik(
    withProps(ResumeHost, { component: asComponent(component), state }),
    {
      containerTagName: CONTAINER_TAG,
      qwikLoader: "never",
      preloader: false,
      base: "/",
      symbolMapper: (symbol: string, _mapper: unknown, parent?: string) =>
        parent ? [symbol, `${devUrl(parent)}_${symbol}.js`] : [symbol, "/@qwik-handlers"],
    },
  );
  return result.html;
};

/**
 * The development server's URL of a segment's module: Qwik names a module outside the server's
 * root by its `/@fs/` URL already, and one inside it by its absolute path.
 */
function devUrl(parent: string): string {
  return parent.startsWith("/@fs/") ? parent : `/@fs/${parent.replace(/^\/+/, "")}`;
}
