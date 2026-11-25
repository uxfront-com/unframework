import { defineEmits } from "@uxfront/unframework";

// Declares one event, `pick`, which its own click emits: a consumer's `onClick` is a native
// listener beside it.
export default function Chip({ label }: { label: string }) {
	const emit = defineEmits<{ pick: [label: string] }>();
	return (
		<button type="button" class="chip" onClick={() => emit("pick", label)}>
			{label}
		</button>
	);
}
