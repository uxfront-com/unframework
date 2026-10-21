<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { text: string; class?: ClassValue; style?: string };

  let { text, class: className, style }: Props = $props();
</script>

<button
  type="button"
  class={["button", className]}
  {style}
><span class="icon" aria-hidden="true">+</span>{text}</button>
