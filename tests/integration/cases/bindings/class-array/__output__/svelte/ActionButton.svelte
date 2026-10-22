<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface ActionButtonProps {
    label: string;
    size: "small" | "medium" | "large";
    primary: boolean;
    busy?: boolean;
    badge: number;
  }

  type Props = ActionButtonProps & { class?: ClassValue; style?: string };

  let {
    label,
    size,
    primary,
    busy = false,
    badge,
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

<button
  type="button"
  class={["button", `button-${size}`, { "button-primary": primary, "is-busy": busy, "button-waiting": busy, "has-badge": badge }, primary ? "solid" : "outline", className]}
  {style}
  {...scopeAttributes(attributes)}
>{label}</button>
