<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Panel from "./Panel.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let showA = $state(true);
  let showB = $state(true);
  let entries = $state.raw<string[]>([]);

  function record(entry: string) {
    entries = [...entries, entry];
  }
</script>

<div class={["board", className]} {style} bind:this={ref} {...attributes}>
  {#if showA}
    <Panel name="a" onclosed={record} />
  {/if}{#if showB}
    <Panel name="b" onclosed={record} />
  {/if}<button type="button" onclick={() => (showA = false)}>Hide a</button
  ><button type="button" onclick={() => (showB = false)}>Hide b</button
  ><output>{entries.join(", ")}</output>
</div>
