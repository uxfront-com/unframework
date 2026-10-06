<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  interface LogLine {
    id: string;
    text: string;
  }

  export interface BuildLogProps {
    target: string;
    failed: boolean;
    lines?: LogLine[] | null;
    warnings?: string[];
  }

  let { target, failed, lines, warnings }: BuildLogProps = $props();
</script>

<section class="build-log" aria-label="Build log">
  <pre>$ make {target}{#if failed}<strong>{" (failed)"}</strong>{/if}
{#each lines ?? [] as line (line.id)}<code>{line.text}{"\n"}</code>{/each}</pre
  ><ul aria-label="Warnings">
    {#each warnings ?? [] as warning (warning)}
      <li>{warning}</li>
    {/each}
  </ul>
</section>
