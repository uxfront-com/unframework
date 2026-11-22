<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, HTMLButtonAttributes } from "svelte/elements";
  import { button } from "virtual:styleframe";
  import "virtual:styleframe.css";

  type Props = Omit<
    HTMLButtonAttributes,
    "label" | "size" | "tone" | "children" | "class" | "style" | "ref"
  > & {
    label: string;
    size?: "sm" | "lg";
    tone?: "neutral" | "primary";
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["button"] | null;
  };

  let {
    label,
    size,
    tone,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<button
  type="button"
  class={[button({ size, tone }), className]}
  {style}
  bind:this={ref}
  {...attributes}
>{label}</button>
