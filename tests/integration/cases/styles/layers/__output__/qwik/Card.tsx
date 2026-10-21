import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ title: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ title, class: className, style }) => {
    return (
      <section class={["card", className]} data-uf-bb60e985="" style={style}>
        <h2 class="title" data-uf-bb60e985="">
          {title}
        </h2>
      </section>
    );
  },
);
