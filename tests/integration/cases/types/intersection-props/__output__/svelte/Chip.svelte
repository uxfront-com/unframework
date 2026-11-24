<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Sized, Toned } from "./types";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type ChipProps = Sized & Toned & { label: string };

  type Props = Omit<
    SvelteHTMLElements["span"],
    "size" | "tone" | "label" | "children" | "class" | "style" | "ref"
  > &
    ChipProps & { class?: ClassValue; style?: string; ref?: HTMLElementTagNameMap["span"] | null };

  let {
    size,
    tone = "neutral",
    label,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<span
  class={[`chip chip-${size} chip-${tone}`, className]}
  {style}
  bind:this={ref}
  {...attributes}
>{label}</span>
