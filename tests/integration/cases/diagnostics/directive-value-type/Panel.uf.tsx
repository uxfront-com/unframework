// UF6007 directive-value-type: TypeScript doesn't type a dashed JSX attribute, so the tsgo oracle
// checks each directive's value against its type argument (ADR-0109). A number for a boolean, a
// string outside the union and an object of another shape are reported. A narrowed value, a
// string in the union, an object of the right shape, and values typed by what they are given to,
// a template literal and a generic call, are not.
import { computed, defineDirective, ref } from "@uxfront/unframework";

import { cast } from "./cast.ts";
import { vFocusTrap, vTone } from "./focus.uf.ts";

const vBox = defineDirective<{ id: string }>({
  mounted(el, box) {
    el.id = box.id;
  },
});

const vPrefixed = defineDirective<`x-${string}`>({
  mounted(el, id) {
    el.id = id;
  },
});

export default function Panel() {
  const open = ref(false);
  const tone = ref<"info" | "warn" | undefined>();
  const named = computed(() => ({ name: "panel" }));
  const box = computed(() => ({ id: "panel" }));
  const count = ref(1);
  return (
    <section>
      <div v-focus-trap={1}>Number</div>
      <p v-tone="loud">Loud</p>
      <p v-box={named.value}>Named</p>
      <div v-focus-trap={open.value}>Open</div>
      <p v-tone="warn">Warn</p>
      {tone.value !== undefined && <p v-tone={tone.value}>Toned</p>}
      <p v-box={box.value}>Box</p>
      {tone.value !== undefined && <p v-tone={`${tone.value}`}>Template</p>}
      <p v-prefixed={`x-${count.value}`}>Prefixed</p>
      <div v-focus-trap={cast(1)}>Cast</div>
    </section>
  );
}
