<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Card from "./Card.svelte";
  import Tip from "./Tip.svelte";
  import { teleport } from "./_unframework/teleport";
  import { onMount } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  interface Row {
    id: number;
    label: string;
  }

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let rows = $state.raw<Row[]>([
    { id: 1, label: "Alpha" },
    { id: 2, label: "Beta" },
    { id: 3, label: "Gamma" },
  ]);

  let late = $state(false);

  let mounted = $state(false);

  onMount(() => {
    mounted = true;
  });
</script>

<section class={["board", className]} aria-label="Board" {style} bind:this={ref} {...attributes}>
  <button type="button" onclick={() => (rows = [...rows].reverse())}>Reverse tips</button
  ><button type="button" onclick={() => (late = true)}>Show late</button
  >{#each rows as row (row.id)}
    <Tip label={row.label} />
  {/each}{#if late}
    {#if mounted}
      <p {@attach teleport("body")} data-teleported="true" class="tip" role="note">Late tip</p>
    {/if}
  {/if}<Card>
    {#if mounted}
      <div {@attach teleport("body")} data-teleported="true" class="slotted">Slotted</div>
    {/if}
  </Card>
</section>
