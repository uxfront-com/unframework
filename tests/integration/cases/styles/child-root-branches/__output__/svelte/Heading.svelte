<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { scopeAttributes } from "./_unframework/scopeAttributes";
  import type { ClassValue } from "svelte/elements";

  type Props = { big: boolean; text: string; class?: ClassValue; style?: string };

  let { big, text, class: className, style, ...attributes }: Props = $props();
</script>

<svelte:element
  this={big ? "h2" : "h3"}
  class={["heading", className]}
  {style}
  {...scopeAttributes(attributes)}
>{text}</svelte:element>
