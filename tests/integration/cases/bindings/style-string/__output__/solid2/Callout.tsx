import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface CalloutProps {
  heading: string;
  body: string;
}

export default function Callout(
  props: CalloutProps &
    Omit<ComponentProps<"aside">, "heading" | "body" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "heading", "body", "class", "style");

  return (
    <aside
      class={props.class ? `callout ${props.class}` : "callout"}
      aria-label={props.heading}
      style={{
        ...{
          "--callout-accent": "#1f4d7a",
          "border-left": "4px solid var(--callout-accent)",
          padding: "8px 12px",
          color: "#1a1a1a",
        },
        ...props.style,
      }}
      {...others}
    >
      <p style={{ margin: "0", "font-weight": "700" }}>{props.heading}</p>
      <p style={{ margin: "4px 0 0" }}>{props.body}</p>
    </aside>
  );
}
