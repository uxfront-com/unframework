<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface Person {
    id: string;
    name: string;
  }
</script>

<script lang="ts">
  import Table from "./Table.svelte";
  import type { ClassValue, HTMLOlAttributes } from "svelte/elements";

  type Props = Omit<HTMLOlAttributes, "people" | "children" | "class" | "style" | "ref" | "row"> & {
    people: Person[];
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["ol"] | null;
  };

  let { people, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<Table {people} class={className} {style} bind:ref {...attributes}>
  {#snippet row({ name, "data-id": id, index })}
    <span>{index + 1}: {name} ({id})</span>
  {/snippet}
</Table>
