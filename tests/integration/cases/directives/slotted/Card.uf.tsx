import { defineDirective, ref } from "@uxfront/unframework";

import Disclosure from "./Disclosure.uf.tsx";

// A directive of the module itself (ADR-0099), which reports each hook's call and its element.
const vTrace = defineDirective<string>({
  mounted(el, value) {
    const call = `mounted ${value}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  unmounted(el) {
    const call = `unmounted ${el.getAttribute("data-name")}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
});

export default function Card() {
  const note = ref<{ name: string } | null>({ name: "note" });

  return (
    <section class="card" aria-label="Card">
      <Disclosure>
        <p data-name="body" v-trace="body">
          Body
        </p>
        {note.value ? (
          <p data-name="note" v-trace={note.value.name}>
            Note
          </p>
        ) : null}
      </Disclosure>
    </section>
  );
}
