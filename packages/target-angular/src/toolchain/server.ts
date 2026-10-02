// The Angular SSR renderer (Node), run by an SSR project of the toolchain's Vite configuration:
// the component is AOT-compiled by ngtsc, and Angular's packages are linked ahead of time as they
// load (see ./linker.ts), so no JIT compiler is loaded, as in a production server.
import { DOCUMENT, createComponent, provideZonelessChangeDetection } from "@angular/core";
import { createApplication, type BootstrapContext } from "@angular/platform-browser";
import { renderApplication } from "@angular/platform-server";
import type { SsrRenderer } from "@unframework/codegen";

import { angularComponent } from "./component.ts";

/** The document the component renders into; only its body is returned. */
const DOCUMENT_HTML = "<html><head></head><body></body></html>";

/**
 * Renders a component on Angular's server platform and returns the content of `<body>`: the
 * component's host element (`<uf-x style="display: contents;">`) and its content. Inputs are
 * set before the first change detection; `createComponent` adds neither `ng-version` nor
 * `ng-server-context`, which `bootstrapApplication` would.
 */
export const renderToString: SsrRenderer = async (component, options) => {
  const type = angularComponent(component);
  const html = await renderApplication(
    async (context: BootstrapContext) => {
      const app = await createApplication(
        { providers: [provideZonelessChangeDetection()] },
        context,
      );
      const ref = createComponent(type, { environmentInjector: app.injector });
      for (const [name, value] of Object.entries(options.props ?? {})) ref.setInput(name, value);
      app.attachView(ref.hostView);
      app.injector.get(DOCUMENT).body.appendChild(ref.location.nativeElement as Node);
      return app;
    },
    // The URL must be an allowed host, or the render fails with NG05706.
    { document: DOCUMENT_HTML, url: "http://localhost/", allowedHosts: ["localhost"] },
  );
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(html);
  if (!body) throw new Error(`Angular rendered a document without a <body>: ${html}`);
  return body[1]!;
};
