<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
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

  let note = $state(false);
  let extras = $state.raw<string[]>([]);

  let rows = $state.raw<Row[]>([
    { id: 1, label: "Alpha" },
    { id: 2, label: "Beta" },
  ]);

  function addExtra() {
    extras = [...extras, `Extra ${extras.length + 1}`];
  }

  let mounted = $state(false);

  onMount(() => {
    mounted = true;
  });
</script>

<section class={["panel", className]} aria-label="Panel" {style} bind:this={ref} {...attributes}>
  <button type="button" onclick={() => (note = true)}>Show note</button
  ><button type="button" onclick={addExtra}>Add extra</button
  ><button type="button" onclick={() => (rows = [...rows].reverse())}>Reverse rows</button
  >{#if note}
    <p class="note">Note</p>
  {/if}{#each extras as extra (extra)}
    <span>{extra}</span>
  {/each}{#if mounted}
    <div {@attach teleport("body")} data-teleported="true" class="first">First</div>
  {/if}{#if mounted}
    <div {@attach teleport("body")} data-teleported="true" class="second">Second</div>
  {/if}<ul>
    {#each rows as row (row.id)}
      <li>{row.label}{#if mounted}<p
        {@attach teleport("body")}
        data-teleported="true"
        class="tip"
      >{row.label} tip</p>{/if}</li>
    {/each}
  </ul>
</section>
