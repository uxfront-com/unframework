<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { title: string; class?: ClassValue; style?: string };

  let { title, class: className, style }: Props = $props();
</script>

<section class={["card", className]} {style} data-uf-bb60e985="">
  <h2 class="title" data-uf-bb60e985="">{title}</h2>
</section>
