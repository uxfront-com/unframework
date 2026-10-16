<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

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

  type Props = BuildLogProps & { class?: ClassValue; style?: string };

  let { target, failed, lines, warnings, class: className, style }: Props = $props();
</script>

<section class={["build-log", className]} aria-label="Build log" {style}>
  <pre>$ make {target}{#if failed}<strong>{" (failed)"}</strong>{/if}
{#each lines ?? [] as line (line.id)}<code>{line.text}{"\n"}</code>{/each}</pre
  ><ul aria-label="Warnings">
    {#each warnings ?? [] as warning (warning)}
      <li>{warning}</li>
    {/each}
  </ul>
</section>
