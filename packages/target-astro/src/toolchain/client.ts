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
 * the server render logged; `settle` has nothing to wait for. A rerender is a new server render
 * with the new props, whose HTML replaces the old, and whose log it returns: a static component
 * has no state to update in place, so a prop the props lack takes its default as on a first render.
 * It takes no listeners (`options.on`): no code of the component runs in the page, so it emits
 * nothing (`interactivity` is unsupported, and a test that listens requires it).
 */
export const mount: MountAdapter = async (component, container, options) => {
  if (!isAstroComponentRef(component)) {
    throw new TypeError(
      "Astro mount: expected what a `.uf.tsx` import yields in an Astro browser project ({ __ufTarget: 'astro', id, name }).",
    );
  }
  const render = async (props: Readonly<Record<string, unknown>>) => {
    const copy = { ...props };
    assertSerialisableProps(copy);
    return commands.ufAstroRender({ id: component.id, props: copy });
  };
  const rendered = await render(options.props ?? {});
  let styles = insert(container, component.name, rendered.html);
  const clear = () => {
    container.replaceChildren();
    for (const style of styles) style.remove();
  };

  return {
    settle: () => Promise.resolve(),
    async rerender(props) {
      const next = await render(props);
      clear();
      styles = insert(container, component.name, next.html);
      return { console: next.console };
    },
    unmount: () => {
      clear();
      return Promise.resolve();
    },
    console: rendered.console,
  };
};

/** Inserts server HTML into the container, its leading `<style>` elements into `<head>`. */
function insert(container: HTMLElement, name: string, html: string): HTMLStyleElement[] {
  const template = document.createElement("template");
  template.innerHTML = html;
  const styles: HTMLStyleElement[] = [];
  while (template.content.firstChild instanceof HTMLStyleElement) {
    const style = template.content.firstChild;
    style.dataset.ufAstroStyle = name;
    styles.push(style);
    document.head.append(style);
  }
  container.append(template.content);
  return styles;
}
