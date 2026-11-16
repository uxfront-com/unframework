import { defineDirective, ref } from "@uxfront/unframework";

import Note from "./Note.uf.tsx";

// The event each hook reports its call with, to whoever listens on the document.
const TRACE = "directive-trace";

// A directive of the module itself (ADR-0099), which reports each hook's call and its element.
const vTrace = defineDirective<string>({
  mounted(el, value) {
    document.dispatchEvent(new CustomEvent(TRACE, { detail: { call: `mounted ${value}`, el } }));
  },
  unmounted(el) {
    const call = `unmounted ${el.getAttribute("data-name")}`;
    document.dispatchEvent(new CustomEvent(TRACE, { detail: { call, el } }));
  },
});

export default function Tree() {
  const shown = ref(true);

  return (
    <section class="tree" aria-label="Tree" data-name="outer" v-trace="outer">
      <p data-name="first" v-trace="first">
        First
      </p>
      <Note />
      {shown.value ? (
        <div class="branch" data-name="branch" v-trace="branch">
          <span data-name="leaf" v-trace="leaf">
            Leaf
          </span>
        </div>
      ) : (
        <p data-name="placeholder" v-trace="placeholder">
          Placeholder
        </p>
      )}
      <p data-name="last" v-trace="last">
        Last
      </p>
      <button type="button" onClick={() => (shown.value = !shown.value)}>
        Toggle
      </button>
    </section>
  );
}
