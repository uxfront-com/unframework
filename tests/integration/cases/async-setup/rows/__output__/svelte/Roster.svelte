<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Member from "./Member.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "ids" | "children" | "class" | "style" | "ref"
  > & {
    ids: string[];
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { ids, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let lead = $state(true);
  let guest = $state(false);
</script>

<section class={["roster", className]} aria-label="Roster" {style} bind:this={ref} {...attributes}>
  <button type="button" onclick={() => (lead = !lead)}>Switch lead</button
  ><button type="button" onclick={() => (guest = !guest)}>Toggle guest</button
  ><ul>
    {#each ids as id (id)}
      <Member {id} />
    {/each}{#if lead}
      <Member id="ada" />
    {:else}
      <Member id="linus" />
    {/if}{#if guest}
      <Member id="hopper" />
    {/if}
  </ul>
</section>
