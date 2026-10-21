import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ text: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ text, class: className, style }) => {
    return (
      <aside class={["panel", className]} data-uf-48dda3f4="" style={style}>
        <p class="text" data-uf-48dda3f4="">
          {text}
        </p>
      </aside>
    );
  },
);
