<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["ul"], "label" | "ontitle" | "onreleased" | "onready" | "onstopped" | "children" | "class" | "style" | "ref"> & {
    label: string;
    ontitle?: (text: string) => void;
    onreleased?: (text: string) => void;
    onready?: (items: number) => void;
    onstopped?: () => void;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["ul"] | null;
  };

  let { label, ontitle, onreleased, onready, onstopped, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

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
    const cleanups: Array<() => void> = [];
    const onCleanup = (cleanup: () => void) => {
      cleanups.push(cleanup);
    };
    const cleanUp = () => {
      for (const cleanup of cleanups) {cleanup();}
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

<ul
  bind:this={() => list, (element) => {
    list = element;
    ref = element;
  }}
  class={className}
  {style}
  {...attributes}
>
  <li>{label}</li
  ><li>{ticks}</li>
</ul>
