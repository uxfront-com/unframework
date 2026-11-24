import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import "./Badge.uf.tsx.css";

export default function Badge(
  props: { label: string; count: number } & Omit<
    ComponentProps<"span">,
    "label" | "count" | "class" | "style"
  > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "label", "count", "class");

  return (
    <span class={props.class ? `badge ${props.class}` : "badge"} data-uf-d9cef2e7="" {...others}>
      <span class="label" data-uf-d9cef2e7="">
        {props.label}
      </span>
      <span class="count" data-uf-d9cef2e7="">
        {props.count}
      </span>
    </span>
  );
}
