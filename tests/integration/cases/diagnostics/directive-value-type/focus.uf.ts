// The directives the panel imports (ADR-0099): one takes a boolean, one a union of strings.
import { defineDirective } from "@uxfront/unframework";

export const vFocusTrap = defineDirective<boolean>({
  mounted(el, active) {
    if (active) el.focus();
  },
});

export const vTone = defineDirective<"info" | "warn">({
  mounted(el, tone) {
    el.setAttribute("data-tone", tone);
  },
});
