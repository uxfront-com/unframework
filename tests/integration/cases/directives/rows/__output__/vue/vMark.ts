import type { ObjectDirective } from "vue";

export const vMark: ObjectDirective<HTMLElement, string> = {
  mounted(el, { value }) {
    const call = `mark mounted ${value}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  updated(el, { value, oldValue }) {
    if (Object.is(value, oldValue)) return;
    const call = `mark updated ${value} ${oldValue}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  unmounted(el) {
    const call = "mark unmounted";
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
};
