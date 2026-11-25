import { defineSlots, provide } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

import { loadUser } from "./api";
import Badge, { ToneKey } from "./Badge.uf.tsx";

// After its await, a setup provides a constant to a child it renders, and one a parent fills in.
export default async function Panel({ id }: { id: string }) {
	const slots = defineSlots<{ default?(): Element }>();
	const user = await loadUser(id);

	provide(ToneKey, "calm");

	return (
		<section class="panel" aria-label={user.name}>
			<Badge />
			{slots.default?.()}
		</section>
	);
}
