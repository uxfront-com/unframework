import type { JSX } from "solid-js";

export default function Stack(
  props: { gap: string; accent: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <ul
      class={props.class ? `stack ${props.class}` : "stack"}
      style={{ ...{ "--gap": props.gap, "--accent": props.accent }, ...props.style }}
      data-uf-e3a22111=""
    >
      <li class="item" data-uf-e3a22111="">
        One
      </li>
      <li class="item" data-uf-e3a22111="">
        Two
      </li>
      <li class="item" data-uf-e3a22111="">
        Three
      </li>
    </ul>
  );
}
