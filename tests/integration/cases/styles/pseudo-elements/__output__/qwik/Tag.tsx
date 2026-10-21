import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ name: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ name, class: className, style }) => {
    return (
      <span class={["tag", className]} data-uf-ef5e671c="" style={style}>
        {name}
      </span>
    );
  },
);
