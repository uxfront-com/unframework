<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { label: string; count: number; class?: ClassValue; style?: string };

  let { label, count, class: className, style }: Props = $props();
</script>

<span class={["badge", className]} {style} data-uf-d9cef2e7="">
  <span class="label" data-uf-d9cef2e7="">{label}</span
  ><span class="count" data-uf-d9cef2e7="">{count}</span>
</span>
