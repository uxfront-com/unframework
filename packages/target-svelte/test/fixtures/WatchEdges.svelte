<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { tick, untrack } from "svelte";

  type Props = {
    onpair?: (first: number, second: number, previous: number) => void;
    ontotal?: (value: number) => void;
    onseen?: (value: number) => void;
    onunseen?: (value: number) => void;
  };

  let { onpair, ontotal, onseen, onunseen }: Props = $props();

  let a = $state(1);
  let b = $state(2);
  let items = $state.raw<number[]>([]);

  let previousAB = untrack((): [typeof a, typeof b] => [a, b]);
  let aBWatched = false;
  $effect.pre(() => {
    const values: [typeof a, typeof b] = [a, b];
    if (aBWatched && values.every((value, index) => Object.is(value, previousAB[index]))) return;
    const [before]: [number | undefined, number | undefined] = (aBWatched ? previousAB : []) as [typeof a | undefined, typeof b | undefined];
    aBWatched = true;
    previousAB = values;
    untrack(() => {
      const [first, second]: [number, number] = values;
      onpair?.(first, second, before ?? 0);
    });
  });

  const watchedSum = $derived.by(() => {
    let sum = 0;
    for (const item of items) sum += item;
    return sum;
  });
  let previousSum = untrack(() => watchedSum);
  $effect.pre(() => {
    const sum: number = watchedSum;
    if (Object.is(sum, previousSum)) return;
    const previous: number = previousSum;
    previousSum = sum;
    untrack(async () => {
      await tick();
      ontotal?.(sum - previous);
    });
  });

  $effect(() => {
    const cleanups: (() => void)[] = [];
    const onCleanup = (cleanup: () => void) => {
      cleanups.push(cleanup);
    };
    const cleanUp = () => {
      for (const cleanup of cleanups) cleanup();
    };
    void (async () => {
      const first = a;
      onCleanup(() => onunseen?.(first));
      await Promise.resolve();
      onseen?.(first);
    })();
    return cleanUp;
  });
</script>

<button
  type="button"
  onclick={() => {
    a++;
    items = [...items, a];
  }}
>{a} {b} {items.length}</button>
