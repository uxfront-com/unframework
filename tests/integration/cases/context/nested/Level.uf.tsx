import { defineSlots, inject, provide } from "unframework";
import type { Element, InjectionKey } from "unframework";

export const DepthKey: InjectionKey<number> = Symbol("uf.depth");

export default function Level({ title }: { title: string }) {
  const slots = defineSlots<{ default?(): Element }>();
  const depth = inject(DepthKey, 0);
  provide(DepthKey, depth + 1);
  return (
    <section aria-label={title}>
      <h2>
        {title} at depth {depth}
      </h2>
      {slots.default?.()}
    </section>
  );
}
