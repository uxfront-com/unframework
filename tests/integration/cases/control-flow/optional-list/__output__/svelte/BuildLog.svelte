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
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "target" | "failed" | "lines" | "warnings" | "children" | "class" | "style" | "ref"
  > &
    BuildLogProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    target,
    failed,
    lines,
    warnings,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<section
  class={["build-log", className]}
  aria-label="Build log"
  {style}
  bind:this={ref}
  {...attributes}
>
  <pre>$ make {target}{#if failed}<strong>{" (failed)"}</strong>{/if}
{#each lines ?? [] as line (line.id)}<code>{line.text}{"\n"}</code>{/each}</pre
  ><ul aria-label="Warnings">
    {#each warnings ?? [] as warning (warning)}
      <li>{warning}</li>
    {/each}
  </ul>
</section>
