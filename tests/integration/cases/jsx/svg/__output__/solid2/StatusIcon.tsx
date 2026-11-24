import type { ComponentProps, JSX } from "@solidjs/web";
import { merge, omit } from "solid-js";

export interface StatusIconProps {
  label: string;
  size?: number;
  colour?: string;
}

export default function StatusIcon(
  rawProps: StatusIconProps &
    Omit<ComponentProps<"svg">, "label" | "size" | "colour" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const props = merge(rawProps, {
    get size() {
      return rawProps.size === undefined ? 24 : rawProps.size;
    },
    get colour() {
      return rawProps.colour === undefined ? "#1f6feb" : rawProps.colour;
    },
  });
  const others = omit(props, "label", "size", "colour", "class");

  return (
    <svg
      class={props.class ? `status-icon ${props.class}` : "status-icon"}
      role="img"
      viewBox="0 0 24 24"
      width={props.size}
      height={props.size}
      fill="none"
      {...others}
    >
      <title>{props.label}</title>
      <defs>
        <linearGradient id="status-icon-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color={props.colour} />
          <stop offset="1" stop-color="#0b3d91" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#status-icon-fill)" />
      <path
        d="M7 12.5l3 3 7-7"
        stroke="#ffffff"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
