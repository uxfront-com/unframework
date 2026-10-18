<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { title?: Snippet; children?: Snippet; class?: ClassValue; style?: string };

  let { title, children, class: className, style }: Props = $props();
</script>

<main class={className} {style}><h1>{@render title?.()}</h1>{@render children?.()}</main>
