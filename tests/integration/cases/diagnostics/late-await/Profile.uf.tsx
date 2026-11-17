// UF2039 late-await: the awaits open the setup and read only props, module values, globals and
// earlier awaits, so an await after a ref and an awaited expression that reads `emit` are
// rejected.
import { defineEmits, ref } from "@uxfront/unframework";

import { loadUser } from "./api";

export default async function Profile({ id }: { id: string }) {
  const emit = defineEmits<{ load: [id: string] }>();
  const user = await loadUser(String(emit));
  const count = ref(0);
  const team = await loadUser(id);
  return (
    <p>
      {user.name} {team.name} {count.value}
    </p>
  );
}
