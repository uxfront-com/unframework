// A directive of a `.uf.ts` module (ADR-0099) that reports its `unmounted` on the document.
import { defineDirective } from "@uxfront/unframework";

export const vMark = defineDirective<string>({
	unmounted(el) {
		document.dispatchEvent(new CustomEvent("mark-unmounted", { detail: el }));
	},
});
