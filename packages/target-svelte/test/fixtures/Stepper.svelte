<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface StepperProps {
    initial?: number;
    step?: number;
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "initial" | "step" | "onchange" | "oncleared" | "children" | "class" | "style" | "ref"> & StepperProps & {
    onchange?: (value: number, changes: number) => void;
    oncleared?: () => void;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { initial = 0, step = 1, onchange, oncleared, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  const limits = { low: 0, high: 10 };
  let count = $state(untrack(() => initial));
  let history = $state.raw<Array<number>>([]);
  const doubled = $derived(count * 2);

  const parity = $derived.by(() => {
    if (count % 2 === 0) {return "even";}
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

<div class={["stepper", className]} data-parity={parity} {style} bind:this={ref} {...attributes}>
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
