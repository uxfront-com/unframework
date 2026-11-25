import { ref } from "@uxfront/unframework";

import { loadUser } from "./api";

// A setup that awaits a user, then keeps a count that starts from what it loaded.
export default async function Profile({ id }: { id: string }) {
	const user = await loadUser(id);
	const visits = ref(user.visits);

	return (
		<p class="profile">
			{user.name}{" "}
			<button type="button" onClick={() => visits.value++}>
				Visits: {visits.value}
			</button>
		</p>
	);
}
