<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface Contributor {
    login: string;
    name: string;
    commits: number;
  }

  export interface ContributorTableProps {
    caption: string;
    contributors: Contributor[];
  }

  let { caption, contributors }: ContributorTableProps = $props();
</script>

<table class="contributors">
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
