<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface ActionButtonProps {
    label: string;
    size: "small" | "medium" | "large";
    primary: boolean;
    busy?: boolean;
    badge: number;
  }
</script>

<script lang="ts">
  import type { ClassValue, HTMLButtonAttributes } from "svelte/elements";

  type Props = Omit<
    HTMLButtonAttributes,
    "label" | "size" | "primary" | "busy" | "badge" | "children" | "class" | "style" | "ref"
  > &
    ActionButtonProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["button"] | null;
    };

  let {
    label,
    size,
    primary,
    busy = false,
    badge,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<button
  type="button"
  class={["button", `button-${size}`, { "button-primary": primary, "is-busy": busy, "button-waiting": busy, "has-badge": badge }, primary ? "solid" : "outline", className]}
  {style}
  bind:this={ref}
  {...attributes}
>{label}</button>
