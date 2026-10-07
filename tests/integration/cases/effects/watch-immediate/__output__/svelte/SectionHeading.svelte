<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount, untrack } from "svelte";

  export interface SectionHeadingProps {
    title: string;
  }

  type Props = SectionHeadingProps & {
    onchange?: (title: string, previous?: string) => void;
    onready?: () => void;
  };

  let { title, onchange, onready }: Props = $props();

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

<h2 class="section-heading">{title}</h2>
