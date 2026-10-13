import { type CSSProperties, type ClassList, Slot, component$ } from "@qwik.dev/core";

export default component$<{ title: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ title, class: className, style }) => {
    return (
      <section class={["panel", className]} aria-label={title} style={style}>
        <h2>{title}</h2>
        <Slot />
      </section>
    );
  },
);
