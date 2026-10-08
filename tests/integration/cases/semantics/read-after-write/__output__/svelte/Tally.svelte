<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  type Props = {
    ontotal?: (value: number) => void;
    onsteps?: (values: number[]) => void;
    onlogged?: (entries: string[]) => void;
  };

  let { ontotal, onsteps, onlogged }: Props = $props();

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
</script>

<section class="tally" aria-label="Tally">
  <p role="status">Count: {count}</p
  ><button type="button" onclick={addTwice}>Add two</button
  ><button type="button" onclick={addFive}>Add five</button
  ><button type="button" onclick={countUp}>Count up three</button
  ><button type="button" onclick={addTenAndReport}>Add ten</button
  ><button type="button" onclickcapture={logCapture} onclick={logBubble}>Log the phases</button
  ><p>Phases: {trail.join(" then ")}</p>
</section>
