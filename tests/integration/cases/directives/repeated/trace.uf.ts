// A directive that reports each hook's call and its element on the document (ADR-0099), so a
// spec counts the calls element by element.
import { defineDirective } from "@uxfront/unframework";

export const vTrace = defineDirective<string>({
  mounted(el, value) {
    const call = `mounted ${value}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  updated(el, value, oldValue) {
    const call = `updated ${value} ${oldValue}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  unmounted(el) {
    document.dispatchEvent(
      new CustomEvent("directive-trace", { detail: { call: "unmounted", el } }),
    );
  },
});
