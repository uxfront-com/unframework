import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface StatusIconProps {
  label: string;
  size?: number;
  colour?: string;
}

export default component$<StatusIconProps & { class?: ClassList; style?: CSSProperties }>(
  ({ label, size = 24, colour = "#1f6feb", class: className, style, ...attributes }) => {
    return (
      <svg
        class={["status-icon", className]}
        role="img"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <title>{label}</title>
        <defs>
          <linearGradient id="status-icon-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color={colour} />
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
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
