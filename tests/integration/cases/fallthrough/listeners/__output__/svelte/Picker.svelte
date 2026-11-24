<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Chip from "./Chip.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let log = $state.raw<string[]>([]);

  function record(line: string) {
    log = [...log, line];
  }
</script>

<section aria-label="Picker" class={className} {style} bind:this={ref} {...attributes}>
  <Chip
    label="Ada"
    onclick={(event) => record(`click on ${(event.currentTarget as Element).localName}`)}
    onpick={(label) => record(`pick ${label}`)}
    onfocus={(event) => record(`focus on ${(event.currentTarget as Element).localName}`)}
    onkeydown={(event) => record(`keydown ${event.key} on ${(event.currentTarget as Element).localName}`)}
  /><ol aria-label="Log">
    {#each log as entry, index (index)}
      <li>{entry}</li>
    {/each}
  </ol>
</section>
