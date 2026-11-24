<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface BadgeProps {
    label: string;
  }
</script>

<script lang="ts">
  import { vMark } from "./vMark.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["span"], "label" | "children" | "class" | "style" | "ref"> &
    BadgeProps & { class?: ClassValue; style?: string; ref?: HTMLElementTagNameMap["span"] | null };

  let { label, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<span
  class={["badge", className]}
  {@attach vMark(() => "badge")}
  {style}
  bind:this={ref}
  {...attributes}
>{label}</span>
