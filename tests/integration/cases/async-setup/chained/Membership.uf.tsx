import { computed } from "@uxfront/unframework";

import { loadTeam, loadUser } from "./api";

// Two awaits, the second reading the first, and a computed value that reads both.
export default async function Membership({ id }: { id: string }) {
  const user = await loadUser(id);
  const team = await loadTeam(user.teamId);
  const summary = computed(() => `${user.name} is in ${team.name}`);

  return (
    <p class="membership" role="status">
      {summary.value}
    </p>
  );
}
