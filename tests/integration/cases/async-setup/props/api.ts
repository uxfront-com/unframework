// The loaders the async-setup cases await (ADR-0101): deterministic, so the server and the
// client resolve to the same values, and each resolves after one microtask, before the harness
// settles a mount.
export interface User {
	name: string;
	visits: number;
	teamId: string;
}

export async function loadUser(id: string): Promise<User> {
	await Promise.resolve();
	return { name: `User ${id}`, visits: id.length, teamId: `team-${id.length}` };
}

export async function loadTeam(id: string): Promise<{ name: string }> {
	await Promise.resolve();
	return { name: `Team ${id}` };
}
