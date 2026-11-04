<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface Person {
    id: string;
    name: string;
  }
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    people: Person[];
    row?: Snippet<[{ name: string; "data-id": string; index: number }]>;
    class?: ClassValue;
    style?: string;
  };

  let { people, row, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<ol aria-label="People" class={className} {style} {...scopeAttributes(attributes)}>
  {#each people as person, index (person.id)}
    <li>{@render row?.({ name: person.name, "data-id": person.id, index })}</li>
  {/each}
</ol>
