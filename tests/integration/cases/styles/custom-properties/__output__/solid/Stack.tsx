import { type ComponentProps, type JSX, splitProps } from "solid-js";
import "./Stack.uf.tsx.css";

export default function Stack(
  props: { gap: string; accent: string } & Omit<
    ComponentProps<"ul">,
    "gap" | "accent" | "style"
  > & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["gap", "accent", "class", "style"]);

  return (
    <ul
      class={props.class ? `stack ${props.class}` : "stack"}
      style={{ ...{ "--gap": props.gap, "--accent": props.accent }, ...props.style }}
      data-uf-e3a22111=""
      {...others}
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
