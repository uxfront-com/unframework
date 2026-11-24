<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { scopeAttributes } from "./_unframework/scopeAttributes";
  import type { ClassValue } from "svelte/elements";

  type Props = { tag: "h1" | "h2" | "h3"; text: string; class?: ClassValue; style?: string };

  let { tag, text, class: className, style, ...attributes }: Props = $props();
</script>

<svelte:element
  this={tag}
  class={["heading", className]}
  {style}
  {...scopeAttributes(attributes)}
>{text}</svelte:element>
