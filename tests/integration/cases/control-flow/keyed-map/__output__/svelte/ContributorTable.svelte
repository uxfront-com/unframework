<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface Contributor {
    login: string;
    name: string;
    commits: number;
  }

  export interface ContributorTableProps {
    caption: string;
    contributors: Contributor[];
  }

  type Props = ContributorTableProps & { class?: ClassValue; style?: string };

  let { caption, contributors, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<table class={["contributors", className]} {style} {...scopeAttributes(attributes)}>
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
