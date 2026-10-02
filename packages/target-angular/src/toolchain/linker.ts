// Angular publishes its packages partially compiled (`ɵɵngDeclare*`). Production builds link
// them ahead of time; without that, the browser and the server need @angular/compiler to finish
// them at runtime (JIT). Analog's dep-optimizer plugin skips linking under Vitest (it registers
// no `load` hook in tests), and Node loads the packages as published, so these plugins link
// them with the Angular CLI's own linker: the pre-bundled dependencies of the browser projects,
// and the packages the SSR projects inline into their module graph.
import type { Plugin } from "vite";

import type { AngularViteTools, JavaScriptTransformer, RolldownPlugin } from "./tools.ts";

/** A rolldown plugin for `optimizeDeps.rolldownOptions.plugins` that AOT-links dependencies. */
export function angularLinker(tools: AngularViteTools): RolldownPlugin {
  let transformer: JavaScriptTransformer | undefined;
  return {
    name: "unframework:angular-linker",
    load: {
      filter: { id: { include: /\.[cm]?js$/, exclude: /^\0/ } },
      async handler(id) {
        transformer ??= tools.createTransformer();
        // The transformer returns the file unchanged when it declares nothing to link.
        const contents = await transformer.transformFile(id);
        return { code: new TextDecoder().decode(contents), moduleType: "js" };
      },
    },
    async buildEnd() {
      // Each optimizer run gets a fresh worker pool; this one is shut down with its run.
      const finished = transformer;
      transformer = undefined;
      await finished?.close();
    },
  };
}

/** Angular's published packages, wherever a package manager puts them. */
const ANGULAR_PACKAGE = /[\\/]node_modules[\\/]@angular[\\/][^?]+\.[cm]?js(?:\?|$)/;

/**
 * A Vite plugin that AOT-links Angular's packages in the SSR module graph, as a production
 * server build does, so a server render never needs the JIT compiler, whatever the order in
 * which the component and the renderer load. The SSR configuration inlines the packages
 * (`ssr.noExternal`) so that they reach it.
 */
export function angularSsrLinker(tools: AngularViteTools): Plugin {
  let transformer: JavaScriptTransformer | undefined;
  return {
    name: "unframework:angular-ssr-linker",
    transform: {
      filter: { id: ANGULAR_PACKAGE },
      async handler(code, id) {
        transformer ??= tools.createTransformer();
        // The transformer returns the code unchanged when it declares nothing to link.
        const linked = await transformer.transformData(id.split("?")[0]!, code);
        // The published source map no longer matches: drop it rather than mislead.
        return { code: new TextDecoder().decode(linked), map: { mappings: "" } };
      },
    },
    async buildEnd() {
      // The server is closing: shut its worker pool down.
      const finished = transformer;
      transformer = undefined;
      await finished?.close();
    },
  };
}
