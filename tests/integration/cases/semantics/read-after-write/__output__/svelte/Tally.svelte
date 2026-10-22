<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = {
    ontotal?: (value: number) => void;
    onsteps?: (values: number[]) => void;
    onlogged?: (entries: string[]) => void;
    class?: ClassValue;
    style?: string;
  };

  let { ontotal, onsteps, onlogged, class: className, style, ...attributes }: Props = $props();

  let count = $state(0);
  let trail = $state.raw<string[]>([]);

  function addTwice() {
    count++;
    count++;
    ontotal?.(count);
  }

  function addFive() {
    count += 5;
    ontotal?.(count);
  }

  function countUp() {
    const seen: number[] = [];
    for (let step = 0; step < 3; step++) {
      count += 1;
      seen.push(count);
    }
    onsteps?.(seen);
  }

  function addTen() {
    count += 10;
  }

  function addTenAndReport() {
    addTen();
    ontotal?.(count);
  }

  function logCapture() {
    trail = [...trail, "capture"];
  }

  function logBubble() {
    trail = [...trail, "bubble"];
    onlogged?.(trail);
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section class={["tally", className]} aria-label="Tally" {style} {...scopeAttributes(attributes)}>
  <p role="status">Count: {count}</p
  ><button type="button" onclick={addTwice}>Add two</button
  ><button type="button" onclick={addFive}>Add five</button
  ><button type="button" onclick={countUp}>Count up three</button
  ><button type="button" onclick={addTenAndReport}>Add ten</button
  ><button type="button" onclickcapture={logCapture} onclick={logBubble}>Log the phases</button
  ><p>Phases: {trail.join(" then ")}</p>
</section>
