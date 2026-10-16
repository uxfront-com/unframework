<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { title: string; children?: Snippet; class?: ClassValue; style?: string };

  let { title, children, class: className, style }: Props = $props();
</script>

<section
  class={["panel", className]}
  aria-label={title}
  {style}
><h2>{title}</h2>{@render children?.()}</section>
