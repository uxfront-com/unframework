import { useTemplateRef } from "@uxfront/unframework";

import Lead from "./Lead.uf.tsx";
import Member from "./Member.uf.tsx";

// A sync parent around async children: one it holds a ref to, a list of them, and one through a
// component whose root is an async child.
export default function Team({ ids }: { ids: string[] }) {
	const first = useTemplateRef<{ reset(): void }>();

	return (
		<section class="team" aria-label="Team">
			<h2>Team</h2>
			<button type="button" onClick={() => first.value?.reset()}>
				Reset
			</button>
			<Member ref={first} id="ada" />
			<ul>
				{ids.map((id) => (
					<li key={id}>
						<Member id={id} />
					</li>
				))}
			</ul>
			<Lead class="lead" id="hopper" />
		</section>
	);
}
