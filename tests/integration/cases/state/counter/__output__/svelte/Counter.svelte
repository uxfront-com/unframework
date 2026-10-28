<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface CounterProps {
    initial?: number;
    step?: number;
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = CounterProps & {
    onchange?: (value: number) => void;
    class?: ClassValue;
    style?: string;
  };

  let { initial = 0, step = 1, onchange, class: className, style, ...attributes }: Props = $props();

  let count = $state(untrack(() => initial));
  const doubled = $derived(count * 2);

  function increment() {
    count += step;
    onchange?.(count);
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["counter", className]} {style} {...scopeAttributes(attributes)}>
  <output>{count}</output
  >{#if doubled > 10}
    <span>Big</span>
  {/if}<button type="button" onclick={increment}>+{step}</button>
</div>
