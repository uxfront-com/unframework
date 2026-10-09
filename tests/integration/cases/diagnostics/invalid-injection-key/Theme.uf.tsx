// UF2033 invalid-injection-key: an injection key is exported, so the components that inject it
// can import it.
import { defineSlots, provide } from "unframework";
import type { Element, InjectionKey } from "unframework";

const ThemeKey: InjectionKey<string> = Symbol("uf.theme");

export default function Theme() {
  const slots = defineSlots<{ default?(): Element }>();
  provide(ThemeKey, "dark");
  return <div class="theme">{slots.default?.()}</div>;
}
