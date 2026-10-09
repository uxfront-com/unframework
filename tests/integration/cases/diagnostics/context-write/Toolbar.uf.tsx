// UF2034 context-write: an injected value belongs to the component that provides it, so code
// does not write through it.
import { defineSlots, inject, provide, ref } from "unframework";
import type { Element, InjectionKey, Ref } from "unframework";

export const ModeKey: InjectionKey<Ref<string>> = Symbol("uf.mode");

function ModeButton() {
  const fallback = ref("view");
  const mode = inject(ModeKey, fallback);
  return (
    <button type="button" onClick={() => (mode.value = "edit")}>
      Mode: {mode.value}
    </button>
  );
}

export default function Toolbar() {
  const slots = defineSlots<{ default?(): Element }>();
  const mode = ref("view");
  provide(ModeKey, mode);
  return (
    <nav>
      <ModeButton />
      {slots.default?.()}
    </nav>
  );
}
