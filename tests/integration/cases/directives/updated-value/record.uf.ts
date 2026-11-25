// A directive that records its value on its element (ADR-0099): `mounted` writes the first,
// and `updated` the new one, the previous one and how many times it ran.
import { defineDirective } from "@uxfront/unframework";

export const vRecord = defineDirective<number>({
	mounted(el, value) {
		el.setAttribute("data-value", String(value));
		el.setAttribute("data-updates", "0");
	},
	updated(el, value, oldValue) {
		el.setAttribute("data-value", String(value));
		el.setAttribute("data-old-value", String(oldValue));
		el.setAttribute("data-updates", String(Number(el.getAttribute("data-updates")) + 1));
	},
});
