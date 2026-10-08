<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount, untrack } from "svelte";

  type Props = {
    size: number;
    onturn?: (value: number, previous: number) => void;
    onleft?: (page: number) => void;
    onspan?: (value: number) => void;
    onrange?: (low: number, high: number) => void;
    onresize?: (value: number, previous?: number) => void;
  };

  let { size, onturn, onleft, onspan, onrange, onresize }: Props = $props();

  let page = $state(1);
  let low = $state(0);
  let high = $state(10);

  let previousPage = untrack(() => page);
  let cleanupPage: (() => void) | undefined;
  $effect.pre(() => {
    const value = page;
    if (Object.is(value, previousPage)) return;
    const previous = previousPage;
    previousPage = value;
    untrack(() => {
      cleanupPage?.();
      const cleanups: (() => void)[] = [];
      cleanupPage = () => {
        for (const cleanup of cleanups) cleanup();
      };
      const onCleanup = (cleanup: () => void) => {
        cleanups.push(cleanup);
      };
      onturn?.(value, previous);
      onCleanup(() => {
        onleft?.(value);
      });
    });
  });
  onMount(() => () => cleanupPage?.());

  const watchedSpan = $derived(high - low);
  let previousSpan = untrack(() => watchedSpan);
  $effect.pre(() => {
    const span = watchedSpan;
    if (Object.is(span, previousSpan)) return;
    previousSpan = span;
    untrack(() => {
      onspan?.(span);
    });
  });

  let previousLowHigh = untrack((): [typeof low, typeof high] => [low, high]);
  $effect(() => {
    const values: [typeof low, typeof high] = [low, high];
    if (values.every((value, index) => Object.is(value, previousLowHigh[index]))) return;
    previousLowHigh = values;
    untrack(() => {
      const [first, last]: [number, number] = values;
      onrange?.(first, last);
    });
  });

  let previousSize = untrack(() => size);
  let sizeWatched = false;
  $effect.pre(() => {
    const value = size;
    if (sizeWatched && Object.is(value, previousSize)) return;
    const previous = sizeWatched ? previousSize : undefined;
    sizeWatched = true;
    previousSize = value;
    untrack(() => {
      onresize?.(value, previous);
    });
  });
</script>

<section aria-label="Pager">
  <p>Page {page}, {low} to {high} of {size}</p
  ><button type="button" onclick={() => page++}>Next</button
  ><button
    type="button"
    onclick={() => {
      low += 10;
      high += 10;
    }}
  >Shift</button>
</section>
