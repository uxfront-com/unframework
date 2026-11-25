import { defineSlots, ref } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

// A child that renders its slot behind its own state, so its parent doesn't render again when
// the slot's content comes and goes.
export default function Disclosure() {
	const slots = defineSlots<{ default?(): Element }>();
	const open = ref(false);

	return (
		<div class="disclosure">
			<button type="button" aria-expanded={open.value} onClick={() => (open.value = !open.value)}>
				Details
			</button>
			{open.value ? <div class="body">{slots.default?.()}</div> : null}
		</div>
	);
}
