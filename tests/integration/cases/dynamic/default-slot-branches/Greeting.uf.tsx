import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

export interface User {
  name: string;
}

// The default slot in both branches of a conditional, each with its own fallback: the first reads
// the user the condition narrows.
export default function Greeting({ user }: { user?: User }) {
  const slots = defineSlots<{ default?(): Element }>();
  return (
    <p class="greeting">
      {user ? <b>{slots.default?.() ?? user.name}</b> : <i>{slots.default?.() ?? "Guest"}</i>}
    </p>
  );
}
