<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Lead from "./Lead.svelte";
  import Member from "./Member.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { ids: string[]; class?: ClassValue; style?: string };

  let { ids, class: className, style, ...attributes }: Props = $props();

  let first: { reset(): void } | null = null;

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section class={["team", className]} aria-label="Team" {style} {...scopeAttributes(attributes)}>
  <h2>Team</h2
  ><button type="button" onclick={() => first?.reset()}>Reset</button
  ><Member bind:this={first} id="ada"
  /><ul>
    {#each ids as id (id)}
      <li>
        <Member {id} />
      </li>
    {/each}
  </ul
  ><Lead id="hopper" class="lead" />
</section>
