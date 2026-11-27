import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

// The default slot in two places at once: the note's header and its footer.
export default function FramedNote({ title }: { title: string }) {
  const slots = defineSlots<{ default?(): Element }>();
  return (
    <article class="framed-note">
      <header>{slots.default?.()}</header>
      <p>{title}</p>
      <footer>{slots.default?.()}</footer>
    </article>
  );
}
