// A directive of a `.uf.ts` module (ADR-0099), which reports each hook's call as `vTrace` does in
// `Tree.uf.tsx`: its hooks run through the same queue as the module's own directive's.
import { defineDirective } from "@uxfront/unframework";

export const vNote = defineDirective<string>({
	mounted(el, value) {
		const call = `mounted ${value}`;
		document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
	},
	unmounted(el) {
		const call = `unmounted ${el.getAttribute("data-name")}`;
		document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
	},
});
