// The Angular mount adapter (browser). No @angular/compiler here: the component is AOT-compiled
// by ngtsc and the pre-bundled framework is linked by the dep optimizer, as in production.
import { createComponent, provideZonelessChangeDetection } from "@angular/core";
import type { ComponentRef } from "@angular/core";
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
  const inputs = new Set<string>();
  let ref: ComponentRef<unknown>;
  let host: HTMLElement;
  try {
    ref = createComponent(type, { environmentInjector: app.injector });
    setInputs(ref, inputs, options.props ?? {});
    host = ref.location.nativeElement as HTMLElement;
    // `appendChild`, which domino has too: test/rerender.test.ts runs this adapter on it.
    container.appendChild(host);
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
    async rerender(props) {
      setInputs(ref, inputs, props);
      await settle();
    },
    async unmount() {
      app.destroy();
      // Angular removes the nodes it inserted; the host element was inserted here.
      host.remove();
    },
  };
};

/**
 * Sets every input `props` has, and each input set before that `props` lacks to `undefined`:
 * an input cannot be unset, and the emitted input's transform turns `undefined` into its
 * default (ADR-0043). For a name that is not an input, Angular logs NG0303, which fails L13.
 */
function setInputs(
  ref: ComponentRef<unknown>,
  set: Set<string>,
  props: Readonly<Record<string, unknown>>,
): void {
  for (const name of set) {
    if (Object.hasOwn(props, name)) continue;
    ref.setInput(name, undefined);
    set.delete(name);
  }
  for (const [name, value] of Object.entries(props)) {
    ref.setInput(name, value);
    set.add(name);
  }
}
