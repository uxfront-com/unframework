import { defineSlots, ref } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

// A child that renders its `body` slot in either branch of a ternary on its own state.
export default function Choice() {
	const slots = defineSlots<{ body?(): Element }>();
	const first = ref(true);

	return (
		<div class="choice">
			{first.value ? <b>{slots.body?.()}</b> : <i>{slots.body?.()}</i>}
			<button type="button" onClick={() => (first.value = !first.value)}>
				Switch
			</button>
		</div>
	);
}
