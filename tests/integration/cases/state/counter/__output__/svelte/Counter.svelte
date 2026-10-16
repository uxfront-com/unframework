<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  export interface CounterProps {
    initial?: number;
    step?: number;
  }

  type Props = CounterProps & {
    onchange?: (value: number) => void;
    class?: ClassValue;
    style?: string;
  };

  let { initial = 0, step = 1, onchange, class: className, style }: Props = $props();

  let count = $state(untrack(() => initial));
  const doubled = $derived(count * 2);

  function increment() {
    count += step;
    onchange?.(count);
  }
</script>

<div class={["counter", className]} {style}>
  <output>{count}</output
  >{#if doubled > 10}
    <span>Big</span>
  {/if}<button type="button" onclick={increment}>+{step}</button>
</div>
