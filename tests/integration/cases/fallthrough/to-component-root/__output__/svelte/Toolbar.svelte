<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Primary from "./Primary.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();
</script>

<div role="toolbar" aria-label="Actions" class={className} {style}>
  <Primary text="Save" class="wide" />
</div>
