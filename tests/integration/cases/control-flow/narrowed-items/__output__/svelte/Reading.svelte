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
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["ul"],
    "sources" | "onopen" | "children" | "class" | "style" | "ref"
  > &
    ReadingProps & {
      onopen?: (href: string) => void;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["ul"] | null;
    };

  let {
    sources,
    onopen,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<ul
  class={["reading", className]}
  aria-label="Reading list"
  {style}
  bind:this={ref}
  {...attributes}
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
