<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface PageCountProps {
    page?: number;
    total: number;
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["nav"],
    "page" | "total" | "onpagechange" | "children" | "class" | "style" | "ref"
  > &
    PageCountProps & {
      onpagechange?: (page: number, previous: number) => void;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["nav"] | null;
    };

  let {
    page = 1,
    total,
    onpagechange,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  const label = $derived(`Page ${page} of ${total}`);

  let previousPage = untrack(() => page);
  $effect.pre(() => {
    const next = page;
    if (Object.is(next, previousPage)) return;
    const previous = previousPage;
    previousPage = next;
    untrack(() => {
      onpagechange?.(next, previous);
    });
  });
</script>

<nav class={["page-count", className]} aria-label="Pages" {style} bind:this={ref} {...attributes}>
  <p role="status">{label}</p
  ><p>Direct: {page}</p>
</nav>
