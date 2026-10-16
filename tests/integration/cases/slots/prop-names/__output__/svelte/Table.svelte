<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  export interface Person {
    id: string;
    name: string;
  }

  type Props = {
    people: Person[];
    row?: Snippet<[{ name: string; "data-id": string; index: number }]>;
    class?: ClassValue;
    style?: string;
  };

  let { people, row, class: className, style }: Props = $props();
</script>

<ol aria-label="People" class={className} {style}>
  {#each people as person, index (person.id)}
    <li>{@render row?.({ name: person.name, "data-id": person.id, index })}</li>
  {/each}
</ol>
