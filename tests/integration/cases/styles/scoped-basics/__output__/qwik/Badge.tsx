import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<
  { label: string; count: number } & { class?: ClassList; style?: CSSProperties }
>(({ label, count, class: className, style }) => {
  return (
    <span class={["badge", className]} data-uf-d9cef2e7="" style={style}>
      <span class="label" data-uf-d9cef2e7="">
        {label}
      </span>
      <span class="count" data-uf-d9cef2e7="">
        {count}
      </span>
    </span>
  );
});
