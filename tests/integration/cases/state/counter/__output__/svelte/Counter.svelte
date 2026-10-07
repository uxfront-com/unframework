<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";

  export interface CounterProps {
    initial?: number;
    step?: number;
  }

  type Props = CounterProps & { onchange?: (value: number) => void };

  let { initial = 0, step = 1, onchange }: Props = $props();

  let count = $state(untrack(() => initial));
  const doubled = $derived(count * 2);

  function increment() {
    count += step;
    onchange?.(count);
  }
</script>

<div class="counter">
  <output>{count}</output
  >{#if doubled > 10}
    <span>Big</span>
  {/if}<button type="button" onclick={increment}>+{step}</button>
</div>
