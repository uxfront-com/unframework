import type { ObjectDirective } from "vue";

export const vMark: ObjectDirective<HTMLElement, string> = {
  unmounted(el) {
    document.dispatchEvent(new CustomEvent("mark-unmounted", { detail: el }));
  },
};
