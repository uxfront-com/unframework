// A directive whose element type is an alias its module declares (ADR-0099): a caller's output
// takes the type from the directive itself, never by the alias's name.
import { defineDirective } from "@uxfront/unframework";

type Field = HTMLInputElement | HTMLTextAreaElement;

export const vSelectable = defineDirective<boolean, Field>({
  mounted(el, value) {
    el.setAttribute("data-selectable", String(value));
  },
});
