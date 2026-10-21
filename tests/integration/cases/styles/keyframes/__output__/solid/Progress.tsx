import type { JSX } from "solid-js";

export default function Progress(
  props: { label: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div
      class={props.class ? `progress ${props.class}` : "progress"}
      data-uf-0738d8af=""
      style={props.style}
    >
      <span class="dot" data-uf-0738d8af="" />
      <span data-uf-0738d8af="">{props.label}</span>
    </div>
  );
}
