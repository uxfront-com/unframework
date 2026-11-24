<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface Person {
    id: string;
    name: string;
  }
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, HTMLOlAttributes } from "svelte/elements";

  type Props = Omit<HTMLOlAttributes, "people" | "row" | "children" | "class" | "style" | "ref"> & {
    people: Person[];
    row?: Snippet<[{ name: string; "data-id": string; index: number }]>;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["ol"] | null;
  };

  let {
    people,
    row,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<ol aria-label="People" class={className} {style} bind:this={ref} {...attributes}>
  {#each people as person, index (person.id)}
    <li>{@render row?.({ name: person.name, "data-id": person.id, index })}</li>
  {/each}
</ol>
