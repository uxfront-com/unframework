<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface StepperProps {
    initial?: number;
    step?: number;
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = StepperProps & {
    onchange?: (value: number, changes: number) => void;
    oncleared?: () => void;
    class?: ClassValue;
    style?: string;
  };

  let { initial = 0, step = 1, onchange, oncleared, class: className, style, ...attributes }: Props = $props();

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

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["stepper", className]} data-parity={parity} {style} {...scopeAttributes(attributes)}>
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
