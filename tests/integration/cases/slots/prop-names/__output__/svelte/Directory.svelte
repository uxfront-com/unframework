<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Table from "./Table.svelte";
  import type { ClassValue } from "svelte/elements";

  export interface Person {
    id: string;
    name: string;
  }

  type Props = { people: Person[]; class?: ClassValue; style?: string };

  let { people, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<Table {people} class={className} {style} {...scopeAttributes(attributes)}>
  {#snippet row({ name, "data-id": id, index })}
    <span>{index + 1}: {name} ({id})</span>
  {/snippet}
</Table>
