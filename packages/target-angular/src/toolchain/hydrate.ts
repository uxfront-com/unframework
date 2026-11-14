// The Angular hydrate adapter (browser, L12, ADR-0095): hydrates the server's HTML with
// `provideClientHydration()`, then behaves as the mount adapter does.
import { createComponent, ErrorHandler, provideZonelessChangeDetection } from "@angular/core";
import type { ComponentRef } from "@angular/core";
import {
  createApplication,
  provideClientHydration,
  withNoIncrementalHydration,
} from "@angular/platform-browser";
import type { HydrateAdapter } from "@unframework.dev/codegen";

import { outputBindings, setInputs } from "./client.ts";
import { angularComponent } from "./component.ts";

/** Angular's hydration errors and warnings: NG0500 to NG0507 (`NG05xx`). */
const HYDRATION_CODE = /NG050\d/;

/** Records what Angular reports during and after hydration: a hydration error is a mismatch. */
class RecordingErrorHandler extends ErrorHandler {
  readonly mismatches: string[] = [];

  override handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    if (HYDRATION_CODE.test(message)) this.mismatches.push(message);
    else super.handleError(error);
  }
}

/**
 * Hydrates `html` (from `renderForHydration`) as a zoneless application with
 * `provideClientHydration()`: the hydration marker (`<!--nghm-->`) and the state script
 * (`ng-state`) go where Angular reads them, as direct children of `<body>`, and the host element
 * into the container, where `createComponent` takes it as its host and hydrates the view the
 * server's `ngh` annotations describe. An NG05xx error, thrown while the component is created
 * or reported through the `ErrorHandler` in a later change detection, and the NG0505 warning
 * that hydration never started, are mismatches. The marker and the script are removed once the
 * component has hydrated, so the next test's hydration never reads them.
 */
export const hydrate: HydrateAdapter = async (component, container, html, options) => {
  const type = angularComponent(component);
  const template = document.createElement("template");
  template.innerHTML = html;
  const moved: ChildNode[] = [];
  // A copy: the loop moves nodes out of the live list.
  for (const node of Array.from(template.content.childNodes)) {
    const marker = node.nodeType === Node.COMMENT_NODE && node.nodeValue === "nghm";
    const state = node instanceof HTMLScriptElement && node.id === "ng-state";
    if (!marker && !state) continue;
    moved.push(node);
    // The marker first in `<body>`, where Angular looks for it.
    if (marker) document.body.prepend(node);
    else document.body.append(node);
  }
  const host = template.content.firstElementChild as HTMLElement | null;
  if (!host) throw new Error(`Angular hydrate: the server rendered no host element:\n${html}`);
  container.append(template.content);
  const errors = new RecordingErrorHandler();
  const { warn } = console;
  console.warn = (...args: unknown[]) => {
    const message = args.map(String).join(" ");
    if (/NG0505/.test(message)) errors.mismatches.push(message);
    warn(...args);
  };
  const app = await createApplication({
    providers: [
      provideZonelessChangeDetection(),
      provideClientHydration(withNoIncrementalHydration()),
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  const inputs = new Set<string>();
  let ref: ComponentRef<unknown>;
  try {
    ref = createComponent(type, {
      environmentInjector: app.injector,
      hostElement: host,
      bindings: outputBindings(options.on, options.events),
    });
    setInputs(ref, inputs, options.props ?? {});
    app.attachView(ref.hostView);
    await app.whenStable();
  } catch (error) {
    app.destroy();
    host.remove();
    throw error;
  } finally {
    console.warn = warn;
    for (const node of moved) node.remove();
  }
  const settle = () => app.whenStable();
  return {
    settle,
    async rerender(props) {
      setInputs(ref, inputs, props);
      await settle();
    },
    async unmount() {
      app.destroy();
      host.remove();
    },
    takeMismatches: () => errors.mismatches.splice(0),
  };
};
