// A marker (ADR-0099): `mounted` writes its value on its element, which only the browser runs,
// so the server's HTML never holds it.
import { defineDirective } from "@uxfront/unframework";

export const vMark = defineDirective<string>({
  mounted(el, value) {
    el.setAttribute("data-directive-mounted", value);
  },
});
