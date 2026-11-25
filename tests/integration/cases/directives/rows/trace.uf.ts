// A directive that reports each hook's call and its element on the document (ADR-0108), each
// call named by its directive, so a spec counts each directive's calls on an element apart.
import { defineDirective } from "@uxfront/unframework";

export const vTrace = defineDirective<string>({
  mounted(el, value) {
    const call = `trace mounted ${value}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  updated(el, value, oldValue) {
    const call = `trace updated ${value} ${oldValue}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  unmounted(el) {
    const call = "trace unmounted";
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
});
