<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface Contributor {
    login: string;
    name: string;
    commits: number;
  }

  export interface ContributorTableProps {
    caption: string;
    contributors: Contributor[];
  }
</script>

<script lang="ts">
  import type { ClassValue, HTMLTableAttributes } from "svelte/elements";

  type Props = Omit<
    HTMLTableAttributes,
    "caption" | "contributors" | "children" | "class" | "style" | "ref"
  > &
    ContributorTableProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["table"] | null;
    };

  let {
    caption,
    contributors,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<table class={["contributors", className]} {style} bind:this={ref} {...attributes}>
  <caption>{caption}</caption
  ><thead>
    <tr>
      <th scope="col">Name</th
      ><th scope="col">Commits</th>
    </tr>
  </thead
  ><tbody>
    {#each contributors as contributor (contributor.login)}
      <tr>
        <td>
          <a href={`https://example.com/people/${contributor.login}`}>{contributor.name}</a>
        </td
        ><td>{contributor.commits}</td>
      </tr>
    {/each}
  </tbody>
</table>
