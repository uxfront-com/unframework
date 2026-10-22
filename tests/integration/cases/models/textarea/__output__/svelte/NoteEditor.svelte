<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let note = $state("Buy milk");

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section aria-label="Note" class={className} {style} {...scopeAttributes(attributes)}>
  <textarea aria-label="Text" bind:value={note}></textarea><output>{note.length} characters</output
  ><button type="button" onclick={() => (note = "")}>Discard</button>
</section>
