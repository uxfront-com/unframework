<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Lead from "./Lead.svelte";
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

  let first: { reset(): void } | null = null;
</script>

<section class={["team", className]} aria-label="Team" {style} bind:this={ref} {...attributes}>
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
  ><Lead class="lead" id="hopper" />
</section>
