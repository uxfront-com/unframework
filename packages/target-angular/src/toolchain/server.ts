// The Angular SSR renderer (Node), run by an SSR project of the toolchain's Vite configuration:
// the component is AOT-compiled by ngtsc, and Angular's packages are linked ahead of time as they
// load (see ./linker.ts), so no JIT compiler is loaded, as in a production server.
import { DOCUMENT, createComponent, provideZonelessChangeDetection } from "@angular/core";
import {
  createApplication,
  provideClientHydration,
  withNoIncrementalHydration,
  type BootstrapContext,
} from "@angular/platform-browser";
import { provideServerRendering, renderApplication } from "@angular/platform-server";
import type { HydrationRenderer, SsrRenderer } from "@unframework.dev/codegen";

import { angularComponent } from "./component.ts";

/** The document the component renders into; only its body is returned. */
const DOCUMENT_HTML = "<html><head></head><body></body></html>";

/**
 * Renders a component on Angular's server platform and returns the content of `<body>`: the
 * component's host element (`<uf-x style="display: contents;">`) and its content. Inputs are
 * set before the first change detection; `createComponent` adds neither `ng-version` nor
 * `ng-server-context`, which `bootstrapApplication` would.
 */
export const renderToString: SsrRenderer = (component, options) =>
  oneAtATime(() => render(component, options, false));

/**
 * Renders the server HTML the hydrate adapter hydrates (L12, ADR-0095): the same render with
 * `provideClientHydration()`, whose `<body>` holds the host with its `ngh` annotation, the
 * hydration marker (`<!--nghm-->`) and the state script (`ng-state`) the client reads.
 */
export const renderForHydration: HydrationRenderer = (component, options) =>
  oneAtATime(() => render(component, options, true));

/** The renders queued in this module instance. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Runs renders one at a time. A hydrate project renders for several pages at once (ADR-0095),
 * and two `renderApplication` calls that overlap lose a render's transfer state: its HTML then
 * has no `ng-state` script, and the client does not hydrate (NG0505).
 */
function oneAtATime<T>(run: () => Promise<T>): Promise<T> {
  const result = queue.then(run, run);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function render(
  component: unknown,
  options: Parameters<SsrRenderer>[1],
  hydration: boolean,
): Promise<string> {
  const type = angularComponent(component);
  const html = await renderApplication(
    async (context: BootstrapContext) => {
      const app = await createApplication(
        {
          providers: [
            provideZonelessChangeDetection(),
            // The hydration data reaches the page in the transfer state, which the server
            // rendering providers serialise into the `ng-state` script.
            ...(hydration
              ? [provideClientHydration(withNoIncrementalHydration()), provideServerRendering()]
              : []),
          ],
        },
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
}
