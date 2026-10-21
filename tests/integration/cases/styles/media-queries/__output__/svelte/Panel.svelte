<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { text: string; class?: ClassValue; style?: string };

  let { text, class: className, style }: Props = $props();
</script>

<aside class={["panel", className]} {style} data-uf-48dda3f4="">
  <p class="text" data-uf-48dda3f4="">{text}</p>
</aside>
