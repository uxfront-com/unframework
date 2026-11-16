import type { ObjectDirective } from "vue";

export const vTrace: ObjectDirective<HTMLElement, string> = {
  mounted(el, { value }) {
    const call = `trace mounted ${value}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  updated(el, { value, oldValue }) {
    if (Object.is(value, oldValue)) return;
    const call = `trace updated ${value} ${oldValue}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  unmounted(el) {
    const call = "trace unmounted";
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
};
