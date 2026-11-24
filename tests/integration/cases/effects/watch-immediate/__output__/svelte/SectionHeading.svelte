<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface SectionHeadingProps {
    title: string;
  }
</script>

<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["h2"],
    "title" | "onchange" | "onready" | "children" | "class" | "style" | "ref"
  > &
    SectionHeadingProps & {
      onchange?: (title: string, previous?: string) => void;
      onready?: () => void;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["h2"] | null;
    };

  let {
    title,
    onchange,
    onready,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let previousTitle = untrack(() => title);
  let titleWatched = false;
  $effect.pre(() => {
    const value = title;
    if (titleWatched && Object.is(value, previousTitle)) return;
    const previous = titleWatched ? previousTitle : undefined;
    titleWatched = true;
    previousTitle = value;
    untrack(() => {
      onchange?.(value, previous);
    });
  });

  onMount(() => {
    onready?.();
  });
</script>

<h2 class={["section-heading", className]} {style} bind:this={ref} {...attributes}>{title}</h2>
