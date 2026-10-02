// The Angular mount adapter (browser). No @angular/compiler here: the component is AOT-compiled
// by ngtsc and the pre-bundled framework is linked by the dep optimizer, as in production.
import { createComponent, provideZonelessChangeDetection } from "@angular/core";
import { createApplication } from "@angular/platform-browser";
import type { MountAdapter } from "@unframework/codegen";

import { angularComponent } from "./component.ts";

/**
 * Mounts a component as its own zoneless application. `createComponent` rather than
 * `bootstrapApplication`: it sets inputs before the first change detection, and adds neither
 * `ng-version` nor the development-mode console message. The host element is created from the
 * component's selector (`<uf-x>`, `display: contents`).
 */
export const mount: MountAdapter = async (component, container, options) => {
  const type = angularComponent(component);
  // Angular 22 is zoneless by default; the provider keeps that explicit across upgrades.
  const app = await createApplication({ providers: [provideZonelessChangeDetection()] });
  let host: HTMLElement;
  try {
    const ref = createComponent(type, { environmentInjector: app.injector });
    for (const [name, value] of Object.entries(options.props ?? {})) ref.setInput(name, value);
    host = ref.location.nativeElement as HTMLElement;
    container.append(host);
    app.attachView(ref.hostView);
  } catch (error) {
    app.destroy();
    throw error;
  }
  // Zoneless change detection is scheduled, not synchronous: stable means it has run.
  const settle = () => app.whenStable();
  await settle();
  return {
    settle,
    async unmount() {
      app.destroy();
      // Angular removes the nodes it inserted; the host element was inserted here.
      host.remove();
    },
  };
};
