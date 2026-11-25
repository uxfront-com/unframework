import { ref } from "@uxfront/unframework";

import Toast from "./Toast.uf.tsx";

// A harness parent that shows the toast at first, and mounts it again on the client.
export default function Inbox() {
	const shown = ref(true);

	return (
		<section aria-label="Inbox">
			<button type="button" onClick={() => (shown.value = !shown.value)}>
				{shown.value ? "Hide" : "Show"}
			</button>
			{shown.value && <Toast />}
		</section>
	);
}
