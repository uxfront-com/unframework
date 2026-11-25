import { defineSlots, ref } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

// A child that renders its `row` slot once per item, and adds and removes items by its own state.
export default function Rows() {
	const slots = defineSlots<{ row?(): Element }>();
	const items = ref([1, 2]);

	return (
		<div class="rows">
			<ul>
				{items.value.map((item) => (
					<li key={item}>{slots.row?.()}</li>
				))}
			</ul>
			<button
				type="button"
				onClick={() => (items.value = [...items.value, items.value.length + 1])}
			>
				Add row
			</button>
			<button type="button" onClick={() => (items.value = items.value.slice(0, -1))}>
				Remove row
			</button>
		</div>
	);
}
