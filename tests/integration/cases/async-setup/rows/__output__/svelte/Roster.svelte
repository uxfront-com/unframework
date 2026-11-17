<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Member from "./Member.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { ids: string[]; class?: ClassValue; style?: string };

  let { ids, class: className, style, ...attributes }: Props = $props();

  let lead = $state(true);
  let guest = $state(false);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section class={["roster", className]} aria-label="Roster" {style} {...scopeAttributes(attributes)}>
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
