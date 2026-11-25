import { loadUser } from "./api";

// The awaited call reads two props, once: a later `id` shows where the template reads it, and
// the loaded name stays.
export default async function Greeting({ id, prefix }: { id: string; prefix: string }) {
	const user = await loadUser(prefix + id);

	return (
		<section class="greeting" aria-label="Greeting">
			<h2>Hello, {user.name}</h2>
			<p>Signed in as {id}</p>
		</section>
	);
}
