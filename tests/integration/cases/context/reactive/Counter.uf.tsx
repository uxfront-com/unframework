import { provide, ref } from "unframework";
import type { InjectionKey, Ref } from "unframework";

import Display from "./Display.uf.tsx";

export const CountKey: InjectionKey<Ref<number>> = Symbol("uf.count");

export default function Counter() {
  const count = ref(1);
  provide(CountKey, count);
  return (
    <section aria-label="Counter">
      <Display />
      <button type="button" onClick={() => (count.value += 1)}>
        Add one
      </button>
    </section>
  );
}
