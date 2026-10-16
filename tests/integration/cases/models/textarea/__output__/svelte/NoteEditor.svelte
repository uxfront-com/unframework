<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();

  let note = $state("Buy milk");
</script>

<section aria-label="Note" class={className} {style}>
  <textarea aria-label="Text" bind:value={note}></textarea><output>{note.length} characters</output
  ><button type="button" onclick={() => (note = "")}>Discard</button>
</section>
