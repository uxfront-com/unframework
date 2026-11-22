<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface TableProps<T extends { id: string; label: string }> {
    caption: string;
    rows: T[];
  }
</script>

<script lang="ts" generics="T extends { id: string; label: string }">
  import type { ClassValue, HTMLTableAttributes } from "svelte/elements";

  type Props = Omit<
    HTMLTableAttributes,
    "caption" | "rows" | "children" | "class" | "style" | "ref"
  > &
    TableProps<T> & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["table"] | null;
    };

  let {
    caption,
    rows,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<table class={className} {style} bind:this={ref} {...attributes}>
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
