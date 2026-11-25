import { ref } from "@uxfront/unframework";

import { vRecord } from "./record.uf.ts";

export default function Meter() {
	const level = ref(1);
	const renders = ref(0);

	return (
		<section class="meter" aria-label="Meter">
			<output class="level" v-record={level.value}>
				Level {level.value}
			</output>
			<p>Rendered again {renders.value} times</p>
			<button type="button" onClick={() => level.value++}>
				Raise
			</button>
			<button type="button" onClick={() => renders.value++}>
				Render again
			</button>
		</section>
	);
}
