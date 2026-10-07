// The Angular mount adapter (browser). No @angular/compiler here: the component is AOT-compiled
// by ngtsc and the pre-bundled framework is linked by the dep optimizer, as in production.
import { createComponent, outputBinding, provideZonelessChangeDetection } from "@angular/core";
import type { Binding, ComponentRef } from "@angular/core";
import { createApplication } from "@angular/platform-browser";
import type { MountAdapter, MountEvent, MountListener } from "@unframework/codegen";

import { angularComponent } from "./component.ts";

/**
 * Mounts a component as its own zoneless application. `createComponent` rather than
 * `bootstrapApplication`: it sets inputs before the first change detection, and adds neither
 * `ng-version` nor the development-mode console message. The host element is created from the
 * component's selector (`<uf-x>`, `display: contents`). The test's listeners are bound to the
 * component's outputs, each named as its event (ADR-0012), when it is created, as a parent's
 * `(change)` would be: they outlive every rerender, which sets inputs only.
 */
export const mount: MountAdapter = async (component, container, options) => {
  const type = angularComponent(component);
  // Angular 22 is zoneless by default; the provider keeps that explicit across upgrades.
  const app = await createApplication({ providers: [provideZonelessChangeDetection()] });
  const inputs = new Set<string>();
  let ref: ComponentRef<unknown>;
  let host: HTMLElement;
  try {
    ref = createComponent(type, {
      environmentInjector: app.injector,
      bindings: outputBindings(options.on, options.events),
    });
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

/**
 * A binding of each listener to the output of its event's name. An `output()` emits one value,
 * so the target emits a payload by its shape (ADR-0047): nothing for an event without members,
 * the value for one required member, and the tuple of the arguments otherwise; the listener gets
 * the arguments back, exactly as many as the component passed.
 */
function outputBindings(
  on: Readonly<Record<string, MountListener>> = {},
  events: readonly MountEvent[] = [],
): Binding[] {
  return Object.entries(on).map(([name, listener]) => {
    const optional = events.find((event) => event.name === name)?.optional;
    if (!optional) {
      throw new Error(
        `Angular mount: the test listens to "${name}", which the component declares no payload for: an output's value is read by the event's shape.`,
      );
    }
    return outputBinding<unknown>(name, (value) => {
      if (!optional.length) listener();
      else if (optional.length === 1 && !optional[0]) listener(value);
      else listener(...(value as unknown[]));
    });
  });
}
