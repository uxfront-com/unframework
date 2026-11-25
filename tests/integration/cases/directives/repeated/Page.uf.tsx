import { ref, useTemplateRef } from "@uxfront/unframework";

import Choice from "./Choice.uf.tsx";
import List from "./List.uf.tsx";
import { vTrace } from "./trace.uf.ts";
import Wrapper from "./Wrapper.uf.tsx";

// One directive use per element of the source, whose element each child renders any number of
// times: once per row of another file's list, in either branch of a ternary, and once per item of
// a scoped slot whose fill reads only the page's state. A template ref beside it is filled too.
export default function Page() {
	const label = ref("first");
	const note = useTemplateRef<HTMLParagraphElement>();
	const noted = ref("");

	return (
		<section class="page" aria-label="Page">
			<Wrapper>
				{{
					row: () => (
						<span data-name="row" v-trace={label.value}>
							Row
						</span>
					),
				}}
			</Wrapper>
			<Choice>
				{{
					body: () => (
						<em data-name="body" v-trace={label.value}>
							Body
						</em>
					),
				}}
			</Choice>
			<List items={["a", "b"]}>
				{{
					item: ({ item }) => (
						<strong data-name="item" v-trace={label.value}>
							{item}
						</strong>
					),
				}}
			</List>
			<p ref={note} data-name="note" v-trace={label.value}>
				Note
			</p>
			<output>{noted.value}</output>
			<button
				type="button"
				onClick={() => (noted.value = note.value?.getAttribute("data-name") ?? "")}
			>
				Check
			</button>
			<button type="button" onClick={() => (label.value = "second")}>
				Rename
			</button>
		</section>
	);
}
