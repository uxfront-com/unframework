import Card from "./Card";
import Chip from "./Chip";
import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ label: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ label, class: className, style }) => {
    const compact = useSignal(true);

    const Tag_1 = compact.value ? Chip : Card;

    return (
      <section aria-label="Tag" class={className} style={style}>
        <>
          <Tag_1 label={label} />
        </>
        <button type="button" onClick$={() => (compact.value = !compact.value)}>
          {compact.value ? "Expand" : "Compact"}
        </button>
      </section>
    );
  },
);
