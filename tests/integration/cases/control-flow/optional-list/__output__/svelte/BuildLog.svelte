<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
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
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = BuildLogProps & { class?: ClassValue; style?: string };

  let { target, failed, lines, warnings, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["build-log", className]}
  aria-label="Build log"
  {style}
  {...scopeAttributes(attributes)}
>
  <pre>$ make {target}{#if failed}<strong>{" (failed)"}</strong>{/if}
{#each lines ?? [] as line (line.id)}<code>{line.text}{"\n"}</code>{/each}</pre
  ><ul aria-label="Warnings">
    {#each warnings ?? [] as warning (warning)}
      <li>{warning}</li>
    {/each}
  </ul>
</section>
