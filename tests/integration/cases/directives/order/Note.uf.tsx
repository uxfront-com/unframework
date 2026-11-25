import { vNote } from "./trace.uf.ts";

// A child whose root applies a module's directive: its hooks sort with its parent's.
export default function Note() {
	return (
		<em data-name="note" v-note="note">
			Note
		</em>
	);
}
