import "./Drawer.css";
import { Transition, ref } from "@uxfront/unframework";

// A transition inside a condition of its own: only a change of its own child runs a leave.
export default function Drawer() {
	const shown = ref(true);
	const open = ref(true);

	return (
		<section aria-label="Filters">
			<button type="button" onClick={() => (shown.value = !shown.value)}>
				Drawer
			</button>
			<button type="button" onClick={() => (open.value = !open.value)}>
				Body
			</button>
			{shown.value && (
				<Transition name="fade">{open.value && <p class="body">Colour, size</p>}</Transition>
			)}
		</section>
	);
}
