import { defineDirective } from "@uxfront/unframework";

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
  return (
    <section class="card" aria-label="Card">
      <Disclosure>
        <p data-name="body" v-trace="body">
          Body
        </p>
      </Disclosure>
    </section>
  );
}
