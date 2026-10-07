<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";

  export interface PageCountProps {
    page?: number;
    total: number;
  }

  type Props = PageCountProps & { onpagechange?: (page: number, previous: number) => void };

  let { page = 1, total, onpagechange }: Props = $props();

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

<nav class="page-count" aria-label="Pages">
  <p role="status">{label}</p
  ><p>Direct: {page}</p>
</nav>
