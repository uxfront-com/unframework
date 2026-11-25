import { defineExpose, ref } from "@uxfront/unframework";

import { loadUser } from "./api";

// An async child: it awaits its user, counts its visits and exposes a reset to its parent.
export default async function Member({ id }: { id: string }) {
	const user = await loadUser(id);
	const visits = ref(user.visits);

	function reset() {
		visits.value = 0;
	}

	defineExpose({ reset });

	return (
		<article class="member">
			<h3>{user.name}</h3>
			<button type="button" onClick={() => visits.value++}>
				{user.name} visits: {visits.value}
			</button>
		</article>
	);
}
