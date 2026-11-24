<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let note = $state("Buy milk");
</script>

<section aria-label="Note" class={className} {style} bind:this={ref} {...attributes}>
  <textarea aria-label="Text" bind:value={note}></textarea><output>{note.length} characters</output
  ><button type="button" onclick={() => (note = "")}>Discard</button>
</section>
