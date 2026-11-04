<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface TableProps<T extends { id: string; label: string }> {
    caption: string;
    rows: T[];
  }
</script>

<script lang="ts" generics="T extends { id: string; label: string }">
  import type { ClassValue } from "svelte/elements";

  type Props = TableProps<T> & { class?: ClassValue; style?: string };

  let { caption, rows, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<table class={className} {style} {...scopeAttributes(attributes)}>
  <caption>{caption}</caption
  ><tbody>
    {#each rows as row (row.id)}
      <tr>
        <th scope="row">{row.id}</th
        ><td>{row.label}</td>
      </tr>
    {/each}
  </tbody>
</table>
