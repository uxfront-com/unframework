// A second directive that reports each hook's call like `vTrace`, named `mark`, so a spec counts
// the two directives' calls on one element apart (ADR-0108).
import { defineDirective } from "@uxfront/unframework";

export const vMark = defineDirective<string>({
	mounted(el, value) {
		const call = `mark mounted ${value}`;
		document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
	},
	updated(el, value, oldValue) {
		const call = `mark updated ${value} ${oldValue}`;
		document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
	},
	unmounted(el) {
		const call = "mark unmounted";
		document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
	},
});
