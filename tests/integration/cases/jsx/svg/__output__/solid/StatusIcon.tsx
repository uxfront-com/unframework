import { type JSX, mergeProps } from "solid-js";

export interface StatusIconProps {
  label: string;
  size?: number;
  colour?: string;
}

export default function StatusIcon(
  rawProps: StatusIconProps & { class?: string; style?: JSX.CSSProperties },
) {
  const props = mergeProps(
    { size: 24, colour: "#1f6feb" } satisfies Partial<StatusIconProps>,
    rawProps,
  );
  return (
    <svg
      class={props.class ? `status-icon ${props.class}` : "status-icon"}
      role="img"
      viewBox="0 0 24 24"
      width={props.size}
      height={props.size}
      fill="none"
      style={props.style}
      {...scopeAttributes(props)}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
