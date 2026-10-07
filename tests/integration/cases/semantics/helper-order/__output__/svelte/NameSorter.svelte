<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount, untrack } from "svelte";

  type Props = {
    onstarted?: (text: string) => void;
    onfirstseen?: (text: string) => void;
    onsecondseen?: (count: number) => void;
    ontotal?: (letters: number) => void;
  };

  let { onstarted, onfirstseen, onsecondseen, ontotal }: Props = $props();

  let names = $state.raw(["Cy", "Al"].toSorted((a, b) => compare(a, b)));
  let count = $state(0);

  onMount(() => {
    onstarted?.(`first ${describe()}`);
  });

  onMount(() => {
    onstarted?.("second");
  });

  let previousCount = untrack(() => count);
  $effect.pre(() => {
    if (Object.is(count, previousCount)) return;
    previousCount = count;
    untrack(() => {
      onfirstseen?.(describe());
    });
  });

  let previousCount_1 = untrack(() => count);
  $effect.pre(() => {
    const value = count;
    if (Object.is(value, previousCount_1)) return;
    previousCount_1 = value;
    untrack(() => {
      onsecondseen?.(value);
    });
  });

  const doubled = $derived(count * 2);
  const letters = $derived(names.join("").length);

  function compare(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function describe(): string {
    return `doubled ${doubled}`;
  }

  function add(name: string) {
    names = [...names, name].toSorted(compare);
    count += 1;
  }

  function report() {
    ontotal?.(letters);
  }
</script>

<section class="name-sorter" aria-label="Names">
  <p>Names: {names.join(", ")}</p
  ><p>Added: {count}</p
  ><button type="button" onclick={() => add("Bo")}>Add Bo</button
  ><button type="button" onclick={report}>Report</button>
</section>
