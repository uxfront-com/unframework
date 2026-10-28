<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface StatusIconProps {
    label: string;
    size?: number;
    colour?: string;
  }
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = StatusIconProps & { class?: ClassValue; style?: string };

  let {
    label,
    size = 24,
    colour = "#1f6feb",
    class: className,
    style,
    ...attributes
  }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<svg
  class={["status-icon", className]}
  role="img"
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  {style}
  {...scopeAttributes(attributes)}
>
  <title>{label}</title
  ><defs>
    <linearGradient id="status-icon-fill" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color={colour} /><stop offset="1" stop-color="#0b3d91" />
    </linearGradient>
  </defs
  ><circle cx="12" cy="12" r="10" fill="url(#status-icon-fill)"
  /><path
    d="M7 12.5l3 3 7-7"
    stroke="#ffffff"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
