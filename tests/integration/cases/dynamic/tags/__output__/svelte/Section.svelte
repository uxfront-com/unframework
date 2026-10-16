<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { title: string; class?: ClassValue; style?: string };

  let { title, class: className, style }: Props = $props();

  let nested = $state(false);
</script>

<article class={className} {style}>
  <svelte:element this={nested ? "h3" : "h2"} class="title">{title}</svelte:element
  ><button type="button" onclick={() => (nested = !nested)}>{nested ? "Lift" : "Nest"}</button>
</article>
