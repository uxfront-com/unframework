import type { ObjectDirective } from "vue";

export const vTrace: ObjectDirective<HTMLElement, string> = {
  mounted(el, { value }) {
    const call = `mounted ${value}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  updated(el, { value, oldValue }) {
    if (Object.is(value, oldValue)) return;
    const call = `updated ${value} ${oldValue}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  unmounted(el) {
    document.dispatchEvent(
      new CustomEvent("directive-trace", { detail: { call: "unmounted", el } }),
    );
  },
};
