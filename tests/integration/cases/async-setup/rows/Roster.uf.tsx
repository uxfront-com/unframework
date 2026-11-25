import { ref } from "@uxfront/unframework";

import Member from "./Member.uf.tsx";

// A sync parent whose async child is a list's row, a ternary's branch and a `&&`'s branch, each
// with no element of the parent's around it.
export default function Roster({ ids }: { ids: string[] }) {
	const lead = ref(true);
	const guest = ref(false);

	return (
		<section class="roster" aria-label="Roster">
			<button type="button" onClick={() => (lead.value = !lead.value)}>
				Switch lead
			</button>
			<button type="button" onClick={() => (guest.value = !guest.value)}>
				Toggle guest
			</button>
			<ul>
				{ids.map((id) => (
					<Member key={id} id={id} />
				))}
				{lead.value ? <Member id="ada" /> : <Member id="linus" />}
				{guest.value && <Member id="hopper" />}
			</ul>
		</section>
	);
}
