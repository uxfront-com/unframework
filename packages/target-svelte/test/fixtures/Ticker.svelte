<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount } from "svelte";

  type Props = {
    label: string;
    ontitle?: (text: string) => void;
    onreleased?: (text: string) => void;
    onready?: (items: number) => void;
    onstopped?: () => void;
  };

  let { label, ontitle, onreleased, onready, onstopped }: Props = $props();

  let ticks = $state(0);
  let list: HTMLUListElement | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  $effect(() => {
    const text = `${label}: ${ticks}`;
    ontitle?.(text);
    return () => {
      onreleased?.(text);
    };
  });

  $effect(() => {
    const cleanups: (() => void)[] = [];
    const onCleanup = (cleanup: () => void) => {
      cleanups.push(cleanup);
    };
    const cleanUp = () => {
      for (const cleanup of cleanups) cleanup();
    };
    const text = label;
    onCleanup(() => {
      onreleased?.(text);
    });
    ontitle?.(text);
    return cleanUp;
  });

  onMount(() => {
    onready?.(list?.childElementCount ?? 0);
    timer = setInterval(() => {
      ticks++;
    }, 1000);
  });

  onMount(() => () => {
    clearInterval(timer);
    onstopped?.();
  });
</script>

<ul bind:this={list}>
  <li>{label}</li
  ><li>{ticks}</li>
</ul>
