<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface CounterProps {
    initial?: number;
    step?: number;
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "initial" | "step" | "onchange" | "children" | "class" | "style" | "ref"
  > &
    CounterProps & {
      onchange?: (value: number) => void;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["div"] | null;
    };

  let {
    initial = 0,
    step = 1,
    onchange,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let count = $state(untrack(() => initial));
  const doubled = $derived(count * 2);

  function increment() {
    count += step;
    onchange?.(count);
  }
</script>

<div class={["counter", className]} {style} bind:this={ref} {...attributes}>
  <output>{count}</output
  >{#if doubled > 10}
    <span>Big</span>
  {/if}<button type="button" onclick={increment}>+{step}</button>
</div>
