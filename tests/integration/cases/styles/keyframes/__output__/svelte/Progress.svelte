<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { label: string; class?: ClassValue; style?: string };

  let { label, class: className, style }: Props = $props();
</script>

<div class={["progress", className]} {style} data-uf-0738d8af="">
  <span class="dot" data-uf-0738d8af=""></span><span data-uf-0738d8af="">{label}</span>
</div>
