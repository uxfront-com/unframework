<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Table from "./Table.svelte";
  import type { ClassValue } from "svelte/elements";

  export interface Person {
    id: string;
    name: string;
  }

  type Props = { people: Person[]; class?: ClassValue; style?: string };

  let { people, class: className, style }: Props = $props();
</script>

<Table {people} class={className} {style}>
  {#snippet row({ name, "data-id": id, index })}
    <span>{index + 1}: {name} ({id})</span>
  {/snippet}
</Table>
