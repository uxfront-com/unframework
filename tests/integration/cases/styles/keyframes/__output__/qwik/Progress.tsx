import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ label: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ label, class: className, style }) => {
    return (
      <div class={["progress", className]} data-uf-0738d8af="" style={style}>
        <span class="dot" data-uf-0738d8af="" />
        <span data-uf-0738d8af="">{label}</span>
      </div>
    );
  },
);
