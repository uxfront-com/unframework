import type { JSX } from "solid-js";

export default function Badge(
  props: { label: string; count: number } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <span
      class={props.class ? `badge ${props.class}` : "badge"}
      data-uf-d9cef2e7=""
      style={props.style}
    >
      <span class="label" data-uf-d9cef2e7="">
        {props.label}
      </span>
      <span class="count" data-uf-d9cef2e7="">
        {props.count}
      </span>
    </span>
  );
}
