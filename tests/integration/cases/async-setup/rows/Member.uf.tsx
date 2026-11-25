import { loadUser } from "./api";

// An async child, which its parent renders as a list's row and as a branch.
export default async function Member({ id }: { id: string }) {
	const user = await loadUser(id);

	return <li class="member">{user.name}</li>;
}
