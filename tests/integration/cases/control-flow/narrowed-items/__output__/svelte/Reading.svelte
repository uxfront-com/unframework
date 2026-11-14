<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export type Source =
    | { kind: "link"; id: string; title: string; href: string }
    | { kind: "book"; id: string; title: string; note?: string };

  export interface ReadingProps {
    sources: Source[];
  }
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = ReadingProps & {
    onopen?: (href: string) => void;
    class?: ClassValue;
    style?: string;
  };

  let { sources, onopen, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<ul
  class={["reading", className]}
  aria-label="Reading list"
  {style}
  {...scopeAttributes(attributes)}
>
  {#each sources as source, index (source.id)}
    <li
      title={source.kind === "link" ? source.href : source.title}
    >{index + 1}. {source.title}{source.kind === "book" && source.note ? ` (${source.note.trim()})` : ""}{#if source.kind === "link"}<button
      type="button"
      onclick={() => onopen?.(source.href)}
    >{`Open ${source.title}`}</button>{/if}</li>
  {/each}
</ul>
