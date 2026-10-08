// UF3041 invalid-slot-use: a slot is rendered, tested or forwarded; called without `?.`, it
// would throw where the parent leaves it empty.
import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Card() {
  const slots = defineSlots<{ default?(): Element }>();
  return <div class="card">{slots.default()}</div>;
}
