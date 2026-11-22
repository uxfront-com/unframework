<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { BadgeProps } from "./types";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["span"],
    "label" | "tone" | "children" | "class" | "style" | "ref"
  > &
    BadgeProps & { class?: ClassValue; style?: string; ref?: HTMLElementTagNameMap["span"] | null };

  let {
    label,
    tone = "info",
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<span
  class={[`badge badge-${tone}`, className]}
  {style}
  bind:this={ref}
  {...attributes}
>{label}</span>
