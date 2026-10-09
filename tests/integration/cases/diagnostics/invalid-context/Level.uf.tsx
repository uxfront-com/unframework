// UF2032 invalid-context: a component that provides a key and injects it reads its parent's
// value, so `inject` comes before `provide`, which Angular would answer from first.
import { defineSlots, inject, provide } from "unframework";
import type { Element, InjectionKey } from "unframework";

export const DepthKey: InjectionKey<number> = Symbol("uf.depth");

export default function Level() {
  const slots = defineSlots<{ default?(): Element }>();
  provide(DepthKey, 1);
  const depth = inject(DepthKey, 0);
  return (
    <section>
      <h2>Depth {depth}</h2>
      {slots.default?.()}
    </section>
  );
}
