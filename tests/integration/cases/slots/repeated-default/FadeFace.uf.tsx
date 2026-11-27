import "./FadeFace.css";
import { Transition, defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

// The default slot in both branches of a conditional a transition animates: while one branch
// leaves, the other enters, so both render it at once.
export default function FadeFace({ bold }: { bold: boolean }) {
  const slots = defineSlots<{ default?(): Element }>();
  return (
    <div class="fade-face">
      <Transition name="face">
        {bold ? <b class="face">{slots.default?.()}</b> : <i class="face">{slots.default?.()}</i>}
      </Transition>
    </div>
  );
}
