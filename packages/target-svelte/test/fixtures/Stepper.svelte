<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";

  export interface StepperProps {
    initial?: number;
    step?: number;
  }

  type Props = StepperProps & {
    onchange?: (value: number, changes: number) => void;
    oncleared?: () => void;
  };

  let { initial = 0, step = 1, onchange, oncleared }: Props = $props();

  const limits = { low: 0, high: 10 };
  let count = $state(untrack(() => initial));
  let history = $state.raw<number[]>([]);
  const doubled = $derived(count * 2);

  const parity = $derived.by(() => {
    if (count % 2 === 0) return "even";
    return "odd";
  });

  let changes = 0;

  function add() {
    count += step;
    history = [...history, count];
    changes += 1;
    onchange?.(count, changes);
  }

  const reset = () => {
    count = limits.low;
    oncleared?.();
  };
</script>

<div class="stepper" data-parity={parity}>
  <output>{count}</output
  >{#if doubled > limits.high}
    <span>Big</span>
  {/if}<button type="button" onclick={add}>+{step}</button
  ><button type="button" onclick={reset}>Reset</button
  ><ol>
    {#each history as value, index (index)}
      <li>{value}</li>
    {/each}
  </ol>
</div>
