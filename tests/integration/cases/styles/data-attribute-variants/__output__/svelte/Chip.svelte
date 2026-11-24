<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, HTMLButtonAttributes } from "svelte/elements";
  import "./Chip.uf.tsx.css";

  type Props = Omit<
    HTMLButtonAttributes,
    "label" | "variant" | "pressed" | "children" | "class" | "style" | "ref"
  > & {
    label: string;
    variant?: "neutral" | "danger";
    pressed?: boolean;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["button"] | null;
  };

  let {
    label,
    variant = "neutral",
    pressed = false,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<button
  type="button"
  class={["chip", className]}
  data-variant={variant}
  data-state={pressed ? "on" : "off"}
  aria-pressed={pressed ? "true" : "false"}
  {style}
  data-uf-69db3802=""
  bind:this={ref}
  {...attributes}
>{label}</button>
