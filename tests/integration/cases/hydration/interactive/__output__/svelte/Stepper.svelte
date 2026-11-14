<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface StepperProps {
    start?: number;
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = StepperProps & {
    onchange?: (value: number) => void;
    class?: ClassValue;
    style?: string;
  };

  let { start = 0, onchange, class: className, style, ...attributes }: Props = $props();

  let count = $state(untrack(() => start));

  function add() {
    count += 1;
    onchange?.(count);
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["stepper", className]} {style} {...scopeAttributes(attributes)}>
  <output>{count}</output><button type="button" onclick={add}>Add one</button>
</div>
