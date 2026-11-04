<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Panel from "./Panel.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let showA = $state(true);
  let showB = $state(true);
  let entries = $state.raw<string[]>([]);

  function record(entry: string) {
    entries = [...entries, entry];
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["board", className]} {style} {...scopeAttributes(attributes)}>
  {#if showA}
    <Panel name="a" onclosed={record} />
  {/if}{#if showB}
    <Panel name="b" onclosed={record} />
  {/if}<button type="button" onclick={() => (showA = false)}>Hide a</button
  ><button type="button" onclick={() => (showB = false)}>Hide b</button
  ><output>{entries.join(", ")}</output>
</div>
