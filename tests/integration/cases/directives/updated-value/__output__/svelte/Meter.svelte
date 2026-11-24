<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { vRecord } from "./vRecord.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let level = $state(1);
  let renders = $state(0);
</script>

<section class={["meter", className]} aria-label="Meter" {style} bind:this={ref} {...attributes}>
  <output class="level" {@attach vRecord(() => level)}>Level {level}</output
  ><p>Rendered again {renders} times</p
  ><button type="button" onclick={() => level++}>Raise</button
  ><button type="button" onclick={() => renders++}>Render again</button>
</section>
