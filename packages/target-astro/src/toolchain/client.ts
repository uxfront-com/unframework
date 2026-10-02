// The browser half of the Astro toolchain: a static mount. Astro has no client runtime, so the
// server renders the component (the `ufAstroRender` command) and this adapter only inserts the
// HTML. Nothing is hydrated and no handler is attached; `<script>` elements parsed from HTML
// never run.
import type { MountAdapter } from "@unframework/codegen";
import { commands } from "vitest/browser";

import { assertSerialisableProps, isAstroComponentRef } from "./protocol.ts";
import type { AstroRenderRequest, AstroRenderResult } from "./protocol.ts";

declare module "vitest/browser" {
  interface BrowserCommands {
    ufAstroRender(request: AstroRenderRequest): Promise<AstroRenderResult>;
  }
}

/**
 * Mounts what `import X from "./X.uf.tsx"` yields in an Astro browser project. The component's
 * own `<style>` elements, which the server puts first, move to `<head>` like the other targets'
 * Vite-injected CSS, so the container holds only the component's markup. `console` carries what
 * the server render logged; `settle` has nothing to wait for.
 */
export const mount: MountAdapter = async (component, container, options) => {
  if (!isAstroComponentRef(component)) {
    throw new TypeError(
      "Astro mount: expected what a `.uf.tsx` import yields in an Astro browser project ({ __ufTarget: 'astro', id, name }).",
    );
  }
  const props = { ...options.props };
  assertSerialisableProps(props);
  const rendered = await commands.ufAstroRender({ id: component.id, props });

  const template = document.createElement("template");
  template.innerHTML = rendered.html;
  const styles: HTMLStyleElement[] = [];
  while (template.content.firstChild instanceof HTMLStyleElement) {
    const style = template.content.firstChild;
    style.dataset.ufAstroStyle = component.name;
    styles.push(style);
    document.head.append(style);
  }
  container.append(template.content);

  return {
    settle: () => Promise.resolve(),
    unmount: () => {
      container.replaceChildren();
      for (const style of styles) style.remove();
      return Promise.resolve();
    },
    console: rendered.console,
  };
};
